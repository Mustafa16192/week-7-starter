import { addDoc, collection, deleteDoc, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export const TASK_COLLECTION = 'dlmWeek7Tasks';
export type Task = { id: string; title: string; completed: boolean; createdBy: string; createdAt: Timestamp | null; pending: boolean };
export function tasksCollection() {
  if (!db) throw new Error('Firebase configuration is missing.');
  return collection(db, TASK_COLLECTION);
}
export async function addTask(title: string, uid: string) {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 140) throw new Error('Use a task title between 1 and 140 characters.');
  await addDoc(tasksCollection(), { title: trimmed, completed: false, createdBy: uid, createdAt: serverTimestamp() });
}
export async function setTaskCompleted(id: string, completed: boolean) {
  await updateDoc(doc(tasksCollection(), id), { completed });
}
export async function removeTask(id: string) {
  await deleteDoc(doc(tasksCollection(), id));
}

export function readableError(error: unknown): string {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect. Please try again.',
    'auth/wrong-password': 'The email or password is incorrect. Please try again.',
    'auth/user-not-found': 'The email or password is incorrect. Please try again.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'An account already uses this email. Try signing in.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/network-request-failed': 'Connection interrupted. Check your internet and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/operation-not-allowed': 'Email sign-in is not enabled yet. Ask the project owner to enable it.',
    'permission-denied': 'Your account could not access the board. Ask the project owner to check access.',
    'unavailable': 'The board is temporarily unavailable. Check your connection and try again.',
  };
  return messages[code || ''] || 'Something went wrong. Please try again.';
}
