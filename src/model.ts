import type { Timestamp } from 'firebase/firestore';
export type Profile = { displayName: string };
export type Room = { id: string; title: string; description: string; lecturerId: string; lecturerName: string; status: 'open' | 'closed'; createdAt: Timestamp | null };
export type Question = { id: string; text: string; authorName: string; anonymous: boolean; answered: boolean; createdAt: Timestamp | null; pending?: boolean };
export type Response = { id: string; text: string; authorName: string; authorId: string; createdAt: Timestamp | null; pending?: boolean };
export type QuestionActivity = { responses: Response[]; voters: string[]; loaded: boolean; error: string };
export const LIMITS = { question: 1000, response: 1000, name: 50, title: 100, description: 500 };
export function requiredText(value: string, label: string, max: number) {
  const text = value.trim();
  if (!text) throw new Error(`Enter ${label}.`);
  if (text.length > max) throw new Error(`${label[0].toUpperCase() + label.slice(1)} must be ${max} characters or fewer.`);
  return text;
}
export function normalizeCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) throw new Error('Enter the six-character room code.');
  return normalized;
}
export function timeLabel(stamp: Timestamp | null, pending = false) {
  if (pending || !stamp) return 'Sending…';
  return stamp.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function sortQuestions(items: Question[], sort: 'newest' | 'popular', activity: Record<string, QuestionActivity>) {
  return [...items].sort((a, b) => {
    if (sort === 'popular') {
      const votes = (activity[b.id]?.voters.length || 0) - (activity[a.id]?.voters.length || 0);
      if (votes) return votes;
    }
    return (b.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) - (a.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
  });
}
export function readableError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'That email and password do not match.',
    'auth/wrong-password': 'That email and password do not match.',
    'auth/email-already-in-use': 'An account already uses that email. Try signing in.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Could not connect. Check your connection and try again.',
    'auth/operation-not-allowed': 'Email/password sign-in needs to be enabled in Firebase Authentication.',
    'permission-denied': 'Access was denied. The room may be closed, or the app’s Firestore rules need to be published.',
    'unavailable': 'Could not reach the database. Check your connection and try again.',
  };
  return (code && messages[code]) || (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}
