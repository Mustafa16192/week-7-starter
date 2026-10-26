// Local emulators only. Never reads .env or connects to the cloud project.
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, connectFirestoreEmulator, getDocs, getFirestore, terminate } from 'firebase/firestore';
import { classroomService } from '../src/firebase/service';

const password = 'LearnTogether123!';
async function client(name: string, email: string, displayName: string) {
  const app = initializeApp({ apiKey: 'demo-local-only', projectId: 'demo-dlm-week7', appId: 'demo-classroom-app' }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  try { await createUserWithEmailAndPassword(auth, email, password); }
  catch (error) { if ((error as { code: string }).code !== 'auth/email-already-in-use') throw error; await signInWithEmailAndPassword(auth, email, password); }
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8088);
  const service = classroomService(db, auth.currentUser!.uid);
  if (!(await service.getProfile())) await service.createProfile(displayName);
  return { app, auth, db, service, profile: { displayName } };
}
async function seed() {
  const host = await client('demo-host', 'lecturer@classroom.test', 'Dr. Morgan');
  const student = await client('demo-student', 'student@classroom.test', 'Alex Chen');
  try {
    const existing = await getDocs(collection(host.db, 'users', host.auth.currentUser!.uid, 'rooms'));
    const code = existing.docs[0]?.id || await host.service.createRoom('SI 669 · Making Firebase click', 'Week 7 workshop · Questions, lightbulb moments, and the bits that need another example.', host.profile);
    await student.service.joinRoom(code);
    const questions = await getDocs(collection(host.db, 'sessions', code, 'questions'));
    if (questions.empty) {
      const first = await student.service.askQuestion(code, 'Where should we put our Firebase configuration values?', false, student.profile);
      await host.service.respond(code, first, 'Keep the web configuration in your local .env file. Commit an .env.example with placeholders so your teammates know what to add.', host.profile);
      await host.service.markAnswered(code, first, true);
      const second = await student.service.askQuestion(code, 'Does everyone need to refresh their page to see a new question?', false, student.profile);
      await host.service.toggleVote(code, second); await student.service.toggleVote(code, second);
      const third = await student.service.askQuestion(code, 'When should we use onSnapshot instead of fetching the data once?', true, student.profile);
      await host.service.respond(code, third, 'Use a listener when the screen should stay current as other people make changes. A one-time read is useful when you only need the data at that moment.', host.profile);
      await student.service.toggleVote(code, third);
    }
    console.log(`Local demo room: ${code}\nLecturer: lecturer@classroom.test\nStudent: student@classroom.test\nPassword for both demo accounts: ${password}`);
  } finally { for (const user of [host, student]) { await terminate(user.db); await deleteApp(user.app); } }
}
seed().catch((error) => { console.error(error); process.exitCode = 1; });
