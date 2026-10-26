import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Timestamp } from 'firebase/firestore';
import { normalizeCode, readableError, requiredText, sortQuestions, timeLabel } from '../src/model';
import type { Question, QuestionActivity } from '../src/model';

test('text validation trims input, rejects blank/long values, preserves paragraphs', () => {
  assert.equal(requiredText('  A question?\nA follow-up.  ', 'a question', 1000), 'A question?\nA follow-up.');
  assert.throws(() => requiredText(' \n\t ', 'a question', 1000), /Enter/);
  assert.throws(() => requiredText('a'.repeat(1001), 'a question', 1000), /1000/);
});
test('room codes accept lowercase and surrounding whitespace but reject malformed codes', () => {
  assert.equal(normalizeCode(' abc123 '), 'ABC123');
  for (const value of ['', 'ABC12', 'ABC 123', 'ABC1234', 'AB/123']) assert.throws(() => normalizeCode(value));
});
test('popular sorting uses votes, then newest time, then stable IDs', () => {
  const q = (id: string, n: number): Question => ({ id, text: id, anonymous: true, authorName: 'Anonymous', answered: false, createdAt: Timestamp.fromMillis(n) });
  const input = [q('b', 20), q('c', 10), q('a', 20)];
  const activity: Record<string, QuestionActivity> = { c: { voters: ['one'], responses: [], loaded: true, error: '' } };
  assert.deepEqual(sortQuestions(input, 'popular', activity).map((item) => item.id), ['c','a','b']);
  assert.deepEqual(sortQuestions(input, 'newest', activity).map((item) => item.id), ['a','b','c']);
  assert.deepEqual(input.map((item) => item.id), ['b','c','a']);
});
test('unresolved timestamps and permission failures have useful UI text', () => {
  assert.equal(timeLabel(null), 'Sending…');
  assert.equal(timeLabel(Timestamp.now(), true), 'Sending…');
  assert.match(readableError({ code: 'permission-denied' }), /room may be closed/);
  assert.match(readableError({ code: 'auth/invalid-credential' }), /do not match/);
});
