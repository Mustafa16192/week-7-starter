import { collection, doc, getDoc, getDocFromServer, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import type { Firestore, Unsubscribe } from 'firebase/firestore';
import type { Profile, Question, Response, Room } from '../model';
import { LIMITS, normalizeCode, requiredText } from '../model';

type Failure = (error: Error) => void;
export function classroomService(db: Firestore, uid: string) {
  const profileRef = doc(db, 'profiles', uid);
  async function getProfile(): Promise<Profile | null> {
    const snapshot = await getDoc(profileRef);
    return snapshot.exists() ? snapshot.data() as Profile : null;
  }
  async function createProfile(name: string) {
    const profile = { displayName: requiredText(name, 'your display name', LIMITS.name) };
    await setDoc(profileRef, profile);
    return profile;
  }
  async function createRoom(titleInput: string, descriptionInput: string, profile: Profile): Promise<string> {
    const title = requiredText(titleInput, 'a room title', LIMITS.title);
    const description = descriptionInput.trim();
    if (description.length > LIMITS.description) throw new Error('Description must be 500 characters or fewer.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = doc(collection(db, 'sessions')).id.slice(0, 6).toUpperCase();
      const created = await runTransaction(db, async (transaction) => {
        const ref = doc(db, 'sessions', code);
        if ((await transaction.get(ref)).exists()) return false;
        transaction.set(ref, { title, description, lecturerId: uid, lecturerName: profile.displayName, status: 'open', createdAt: serverTimestamp() });
        transaction.set(doc(ref, 'members', uid), { joinedAt: serverTimestamp() });
        transaction.set(doc(db, 'users', uid, 'rooms', code), { joinedAt: serverTimestamp() });
        return true;
      });
      if (created) return code;
    }
    throw new Error('Could not allocate a room code. Please try again.');
  }
  async function joinRoom(input: string) {
    const code = normalizeCode(input);
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, 'sessions', code);
      const memberRef = doc(roomRef, 'members', uid);
      const room = await transaction.get(roomRef);
      if (!room.exists()) throw new Error('No room matches that code. Check it with your lecturer.');
      const member = await transaction.get(memberRef);
      if (member.exists()) return;
      if (room.data().status !== 'open') throw new Error('This room is closed to new participants.');
      transaction.set(memberRef, { joinedAt: serverTimestamp() });
      transaction.set(doc(db, 'users', uid, 'rooms', code), { joinedAt: serverTimestamp() });
    });
    return code;
  }
  function subscribeRooms(next: (rooms: Room[]) => void, fail: Failure): Unsubscribe {
    const listeners = new Map<string, Unsubscribe>();
    const rooms = new Map<string, Room>();
    const emit = () => next([...rooms.values()].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
    const stop = onSnapshot(collection(db, 'users', uid, 'rooms'), (snapshot) => {
      const ids = new Set(snapshot.docs.map((item) => item.id));
      for (const [id, unsubscribe] of listeners) if (!ids.has(id)) { unsubscribe(); listeners.delete(id); rooms.delete(id); }
      if (!ids.size) emit();
      for (const id of ids) if (!listeners.has(id)) {
        listeners.set(id, onSnapshot(doc(db, 'sessions', id), (room) => {
          if (room.exists()) rooms.set(id, { ...room.data(), id } as Room); else rooms.delete(id);
          emit();
        }, fail));
      }
    }, fail);
    return () => { stop(); listeners.forEach((unsubscribe) => unsubscribe()); };
  }
  function subscribeRoom(code: string, next: (room: Room | null) => void, fail: Failure) {
    return onSnapshot(doc(db, 'sessions', code), (snapshot) => next(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Room : null), fail);
  }
  function subscribeQuestions(code: string, next: (items: Question[], cached: boolean) => void, fail: Failure) {
    return onSnapshot(query(collection(db, 'sessions', code, 'questions'), orderBy('createdAt', 'desc')), { includeMetadataChanges: true }, (snapshot) => next(snapshot.docs.map((item) => ({ ...item.data(), id: item.id, pending: item.metadata.hasPendingWrites } as Question)), snapshot.metadata.fromCache), fail);
  }
  function subscribeAuthored(code: string, next: (ids: Set<string>) => void, fail: Failure) {
    return onSnapshot(query(collection(db, 'users', uid, 'authored'), orderBy('createdAt', 'desc')), (snapshot) => next(new Set(snapshot.docs.filter((item) => item.data().sessionId === code).map((item) => item.data().questionId as string))), fail);
  }
  function subscribeResponses(code: string, questionId: string, next: (items: Response[]) => void, fail: Failure) {
    return onSnapshot(query(collection(db, 'sessions', code, 'questions', questionId, 'responses'), orderBy('createdAt', 'asc')), { includeMetadataChanges: true }, (snapshot) => next(snapshot.docs.map((item) => ({ ...item.data(), id: item.id, pending: item.metadata.hasPendingWrites } as Response))), fail);
  }
  function subscribeVotes(code: string, questionId: string, next: (ids: string[]) => void, fail: Failure) {
    return onSnapshot(collection(db, 'sessions', code, 'questions', questionId, 'votes'), (snapshot) => next(snapshot.docs.map((item) => item.id)), fail);
  }
  async function requireOpen(code: string) {
    const room = await getDocFromServer(doc(db, 'sessions', code));
    if (!room.exists() || room.data().status !== 'open') throw new Error('This room is read-only. Your draft has been kept.');
  }
  async function askQuestion(code: string, input: string, anonymous: boolean, profile: Profile) {
    const text = requiredText(input, 'a question', LIMITS.question);
    await requireOpen(code);
    const ref = doc(collection(db, 'sessions', code, 'questions'));
    const batch = writeBatch(db);
    batch.set(ref, { text, authorName: anonymous ? 'Anonymous' : profile.displayName, anonymous, answered: false, createdAt: serverTimestamp() });
    batch.set(doc(db, 'users', uid, 'authored', `${code}_${ref.id}`), { sessionId: code, questionId: ref.id, createdAt: serverTimestamp() });
    await batch.commit();
    return ref.id;
  }
  async function respond(code: string, questionId: string, input: string, profile: Profile) {
    const text = requiredText(input, 'a response', LIMITS.response);
    await requireOpen(code);
    await setDoc(doc(collection(db, 'sessions', code, 'questions', questionId, 'responses')), { text, authorName: profile.displayName, authorId: uid, createdAt: serverTimestamp() });
  }
  async function toggleVote(code: string, questionId: string) {
    const ref = doc(db, 'sessions', code, 'questions', questionId, 'votes', uid);
    await runTransaction(db, async (transaction) => {
      const room = await transaction.get(doc(db, 'sessions', code));
      const vote = await transaction.get(ref);
      if (room.data()?.status !== 'open') throw new Error('This room is read-only.');
      if (vote.exists()) transaction.delete(ref); else transaction.set(ref, { createdAt: serverTimestamp() });
    });
  }
  async function markAnswered(code: string, questionId: string, answered: boolean) {
    await requireOpen(code);
    const batch = writeBatch(db);
    batch.update(doc(db, 'sessions', code, 'questions', questionId), { answered });
    await batch.commit();
  }
  async function setRoomStatus(code: string, status: 'open' | 'closed') {
    const batch = writeBatch(db);
    batch.update(doc(db, 'sessions', code), { status });
    await batch.commit();
  }
  return { getProfile, createProfile, createRoom, joinRoom, subscribeRooms, subscribeRoom, subscribeQuestions, subscribeAuthored, subscribeResponses, subscribeVotes, askQuestion, respond, toggleVote, markAnswered, setRoomStatus };
}
export type ClassroomService = ReturnType<typeof classroomService>;
