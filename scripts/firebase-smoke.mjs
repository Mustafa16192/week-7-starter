// Live integration check: creates disposable users/tasks and removes only its own fixtures.
// Run against a class/test Firebase project with this repository's rules deployed.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getFirestore, getDocFromServer, getDocsFromServer, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, terminate, setLogLevel } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
assert.ok(Object.values(config).every(Boolean), 'Populate .env.local first.');
setLogLevel('silent');
const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
const clients = ['owner', 'teammate', 'visitor'].map((name) => {
  const app = initializeApp(config, `${name}-${stamp}`);
  return { app, auth: getAuth(app), db: getFirestore(app), email: `dlm-qa-${name}-${stamp}@example.com`, password: randomBytes(18).toString('base64url') + 'A1!' };
});
const [owner, teammate, visitor] = clients;
const path = `dlmWeek7Tasks/qa-${stamp}`;
const invalidPath = `dlmWeek7Tasks/qa-invalid-${stamp}`;
const ownerRef = doc(owner.db, path);
let stop = () => {};
let observed = null;
let listenerError = null;
const checks = [];
async function test(name, run) { await run(); checks.push(name); console.log(`PASS ${name}`); }
async function denied(action) { await assert.rejects(action, (error) => error.code === 'permission-denied'); }
async function waitFor(predicate) {
  const deadline = Date.now() + 15000;
  while (!predicate()) {
    if (listenerError) throw listenerError;
    if (Date.now() > deadline) throw new Error('Live update did not arrive within 15 seconds.');
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}
try {
  await test('Two distinct users can register', async () => {
    for (const client of [owner, teammate]) await createUserWithEmailAndPassword(client.auth, client.email, client.password);
    assert.notEqual(owner.auth.currentUser.uid, teammate.auth.currentUser.uid);
  });
  await test('Signed-out reads and writes are denied', async () => {
    await denied(() => getDocsFromServer(collection(visitor.db, 'dlmWeek7Tasks')));
    await denied(() => setDoc(doc(visitor.db, invalidPath), { title: 'Unauthorized', completed: false, createdBy: 'spoof', createdAt: serverTimestamp() }));
  });
  const uid = owner.auth.currentUser.uid;
  stop = onSnapshot(doc(teammate.db, path), (snapshot) => { observed = snapshot; }, (error) => { listenerError = error; });
  await waitFor(() => observed !== null);
  await test('Task creation is delivered to a second client live', async () => {
    await setDoc(ownerRef, { title: "QA: review the team's prototype", completed: false, createdBy: uid, createdAt: serverTimestamp() });
    await waitFor(() => observed.exists() && observed.data().title === "QA: review the team's prototype");
  });
  await test('A teammate can update completion; listener receives the update', async () => {
    await updateDoc(doc(teammate.db, path), { completed: true });
    await waitFor(() => observed.data()?.completed === true);
    assert.equal((await getDocFromServer(ownerRef)).data().completed, true);
  });
  await test('Creator identity, schema, and titles are protected', async () => {
    await denied(() => updateDoc(doc(teammate.db, path), { createdBy: teammate.auth.currentUser.uid }));
    await denied(() => updateDoc(ownerRef, { title: 'Changed title' }));
    for (const title of ['', '   ', 'x'.repeat(141)]) {
      await denied(() => setDoc(doc(owner.db, invalidPath), { title, completed: false, createdBy: uid, createdAt: serverTimestamp() }));
    }
    await denied(() => setDoc(doc(owner.db, invalidPath), { title: 'Spoofed creator', completed: false, createdBy: teammate.auth.currentUser.uid, createdAt: serverTimestamp() }));
  });
  await test('A teammate cannot delete another user’s task', async () => denied(() => deleteDoc(doc(teammate.db, path))));
  await test('Wrong passwords fail; signing back in preserves stored data', async () => {
    await signOut(owner.auth);
    await assert.rejects(() => signInWithEmailAndPassword(owner.auth, owner.email, 'Incorrect-password-123!'), (error) => ['auth/invalid-credential', 'auth/wrong-password'].includes(error.code));
    await signInWithEmailAndPassword(owner.auth, owner.email, owner.password);
    assert.equal((await getDocFromServer(ownerRef)).data().completed, true);
  });
  await test('Creator deletion is delivered to the other client live', async () => {
    await deleteDoc(ownerRef);
    await waitFor(() => observed !== null && !observed.exists());
  });
  console.log(`Completed ${checks.length} live Firebase checks.`);
} finally {
  stop();
  if (owner.auth.currentUser) {
    await deleteDoc(ownerRef).catch(() => {});
    await deleteDoc(doc(owner.db, invalidPath)).catch(() => {});
  }
  for (const client of clients) {
    if (client.auth.currentUser) await deleteUser(client.auth.currentUser);
    await terminate(client.db);
    await deleteApp(client.app);
  }
}
