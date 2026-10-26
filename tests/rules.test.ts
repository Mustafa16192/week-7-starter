import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocFromServer, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { classroomService } from '../src/firebase/service';
import type { Question, Response } from '../src/model';

let env: RulesTestEnvironment;
let hostDb: Firestore, studentDb: Firestore, outsiderDb: Firestore;
let host: ReturnType<typeof classroomService>, student: ReturnType<typeof classroomService>;
let code: string;
const hostProfile = { displayName: 'Dr. Morgan' };
const studentProfile = { displayName: 'Alex' };
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-dlm-week7', firestore: { host: '127.0.0.1', port: 8088, rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  hostDb = env.authenticatedContext('lecturer').firestore() as unknown as Firestore;
  studentDb = env.authenticatedContext('student').firestore() as unknown as Firestore;
  outsiderDb = env.authenticatedContext('outsider').firestore() as unknown as Firestore;
  host = classroomService(hostDb, 'lecturer'); student = classroomService(studentDb, 'student');
  await host.createProfile(hostProfile.displayName); await student.createProfile(studentProfile.displayName);
  code = await host.createRoom('SI 669 · Firebase', 'Assignment questions', hostProfile);
  await student.joinRoom(code);
});
after(async () => { await env.cleanup(); });
const qref = (db: Firestore, id: string) => doc(db, 'sessions', code, 'questions', id);
const newQuestion = () => student.askQuestion(code, 'How do live listeners work?', true, studentProfile);
async function waitFor(predicate: () => boolean) { const deadline = Date.now() + 8000; while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out waiting for live update'); await new Promise((r) => setTimeout(r, 30)); } }

test('room creation persists ownership, membership and private room history', async () => {
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.equal((await getDoc(doc(hostDb, 'sessions', code))).data()?.lecturerId, 'lecturer');
  await assertSucceeds(getDoc(doc(studentDb, 'users', 'student', 'rooms', code)));
  await assertFails(getDoc(doc(hostDb, 'users', 'student', 'rooms', code)));
  await assertFails(getDocs(collection(outsiderDb, 'sessions')));
});
test('signed-out visitors and nonmembers cannot read question content', async () => {
  const id = await newQuestion();
  const guest = env.unauthenticatedContext().firestore() as unknown as Firestore;
  await assertFails(getDoc(doc(guest, 'sessions', code)));
  await assertFails(getDoc(qref(outsiderDb, id)));
  await assertFails(getDocs(collection(outsiderDb, 'sessions', code, 'questions')));
});
test('anonymous records reveal no author ID; even the lecturer cannot read authorship', async () => {
  const id = await newQuestion(); const data = (await getDoc(qref(hostDb, id))).data()!;
  assert.equal(data.authorName, 'Anonymous'); assert.equal(data.anonymous, true);
  assert.equal('authorId' in data, false); assert.equal('authorEmail' in data, false);
  await assertSucceeds(getDoc(doc(studentDb, 'users', 'student', 'authored', `${code}_${id}`)));
  await assertFails(getDoc(doc(hostDb, 'users', 'student', 'authored', `${code}_${id}`)));
  await assertFails(getDocs(collection(hostDb, 'users', 'student', 'authored')));
  await assertFails(getDoc(doc(hostDb, 'profiles', 'student')));
});
test('named questions use the authenticated profile and cannot carry hidden identity fields', async () => {
  const id = await student.askQuestion(code, ' A named question ', false, studentProfile);
  assert.equal((await getDoc(qref(hostDb, id))).data()?.authorName, 'Alex');
  await assert.rejects(student.askQuestion(code, 'Spoofed name', false, { displayName: 'Dr. Morgan' }));
  await assertFails(updateDoc(qref(studentDb, id), { authorId: 'student' }));
});
test('another user cannot claim an existing question as their own', async () => {
  const id = await newQuestion();
  await assertFails(setDoc(doc(hostDb, 'users', 'lecturer', 'authored', `${code}_${id}`), { sessionId: code, questionId: id, createdAt: serverTimestamp() }));
});
test('responses require genuine member identity and a real parent question', async () => {
  const id = await newQuestion();
  await host.respond(code, id, 'A listener delivers new snapshots.', hostProfile);
  const responses = await getDocs(collection(studentDb, 'sessions', code, 'questions', id, 'responses'));
  assert.equal(responses.docs[0].data().authorId, 'lecturer');
  await assertFails(setDoc(doc(studentDb, 'sessions', code, 'questions', id, 'responses', 'spoof'), { text: 'Pretending', authorId: 'lecturer', authorName: 'Dr. Morgan', createdAt: serverTimestamp() }));
  await assert.rejects(student.respond(code, 'missing', 'An orphan', studentProfile));
});
test('votes are limited to one per identity and cannot be changed on behalf of someone else', async () => {
  const id = await newQuestion(); await student.toggleVote(code, id);
  const votes = collection(studentDb, 'sessions', code, 'questions', id, 'votes');
  assert.equal((await getDocs(votes)).size, 1);
  await assertFails(setDoc(doc(votes, 'student'), { createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(votes, 'lecturer'), { createdAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(hostDb, 'sessions', code, 'questions', id, 'votes', 'student')));
  await student.toggleVote(code, id); assert.equal((await getDocs(votes)).size, 0);
});
test('only the lecturer can mark answered, and question text remains immutable', async () => {
  const id = await newQuestion();
  await assertFails(updateDoc(qref(studentDb, id), { answered: true }));
  await host.markAnswered(code, id, true); assert.equal((await getDoc(qref(studentDb, id))).data()?.answered, true);
  await assertFails(updateDoc(qref(hostDb, id), { text: 'Edited' }));
  await assertFails(updateDoc(doc(studentDb, 'sessions', code), { lecturerId: 'student' }));
  await assertFails(updateDoc(doc(studentDb, 'sessions', code), { status: 'closed' }));
});
test('closed rooms block direct writes, permit member reads, and can reopen', async () => {
  const id = await newQuestion(); await student.toggleVote(code, id); await host.setRoomStatus(code, 'closed');
  await assertSucceeds(getDoc(qref(studentDb, id)));
  await assertFails(deleteDoc(doc(studentDb, 'sessions', code, 'questions', id, 'votes', 'student')));
  await assertFails(setDoc(doc(hostDb, 'sessions', code, 'questions', id, 'votes', 'lecturer'), { createdAt: serverTimestamp() }));
  await assertFails(updateDoc(qref(hostDb, id), { answered: true }));
  await assertFails(setDoc(doc(studentDb, 'sessions', code, 'questions', id, 'responses', 'closed'), { text: 'Too late', authorId: 'student', authorName: 'Alex', createdAt: serverTimestamp() }));
  const visitor = classroomService(outsiderDb, 'outsider'); await visitor.createProfile('Visitor');
  await assert.rejects(visitor.joinRoom(code), /closed/);
  await host.setRoomStatus(code, 'open'); await visitor.joinRoom(code); await student.respond(code, id, 'Now open', studentProfile);
});
test('rules reject empty, whitespace, long, malformed and extra-field questions', async () => {
  for (const text of ['', ' \n\t ', 'x'.repeat(1001), 17]) {
    const ref = doc(collection(studentDb, 'sessions', code, 'questions')); const batch = writeBatch(studentDb);
    batch.set(ref, { text, authorName: 'Anonymous', anonymous: true, answered: false, createdAt: serverTimestamp() });
    batch.set(doc(studentDb, 'users', 'student', 'authored', `${code}_${ref.id}`), { sessionId: code, questionId: ref.id, createdAt: serverTimestamp() });
    await assertFails(batch.commit());
  }
  const id = await student.askQuestion(code, 'First line\nSecond line', true, studentProfile);
  assert.equal((await getDoc(qref(hostDb, id))).data()?.text, 'First line\nSecond line');
});
test('members of one room cannot read another room’s questions', async () => {
  const other = classroomService(outsiderDb, 'outsider'); await other.createProfile('Elsewhere');
  const otherCode = await other.createRoom('Other class', '', { displayName: 'Elsewhere' });
  const id = await other.askQuestion(otherCode, 'Private to this room', true, { displayName: 'Elsewhere' });
  await assertFails(getDoc(doc(studentDb, 'sessions', otherCode, 'questions', id)));
});
test('live listeners deliver questions, responses and state changes, then unsubscribe', async () => {
  let questions: Question[] = []; let responses: Response[] = []; let calls = 0;
  const fail = (err: Error) => { throw err; };
  const stop = host.subscribeQuestions(code, (items) => { questions = items; calls++; }, fail);
  await waitFor(() => calls > 0);
  const id = await newQuestion(); await waitFor(() => questions.some((q) => q.id === id));
  const stopReplies = student.subscribeResponses(code, id, (items) => { responses = items; }, fail);
  await host.respond(code, id, 'Live reply', hostProfile); await waitFor(() => responses.length === 1);
  await host.markAnswered(code, id, true); await waitFor(() => questions.find((q) => q.id === id)?.answered === true);
  assert.equal((await getDocFromServer(qref(studentDb, id))).data()?.answered, true);
  stop(); stopReplies(); const before = calls;
  await student.askQuestion(code, 'After unsubscribe', true, studentProfile);
  await new Promise((resolve) => setTimeout(resolve, 100)); assert.equal(calls, before);
});
