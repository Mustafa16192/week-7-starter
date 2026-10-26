# Classroom Q&A — QA record

Verified October 26, 2026. Results distinguish local emulator testing, browser testing, and the group's live Firebase project.

## Automated checks

- Unit tests: 4 passing (input validation, room codes, stable ordering, timestamp/error handling).
- Firestore emulator tests: 12 passing, covering membership, anonymous-author privacy, impersonation attempts, lecturer permissions, votes, room closure, room isolation, text limits, and two-client live updates.
- TypeScript, ESLint, and production web export: passed after the mobile scroll-reference typing correction.
- An iOS export artifact was generated; native device interaction was not tested.

## Browser checks

Using separate localhost and 127.0.0.1 origins against local emulators, verified sign-in, room creation/joining, invalid-code errors, empty rooms, blank-question validation, anonymous question posting, live lecturer replies, lecturer badges, answered state, voting, popular sorting, close/reopen behavior, and persistence after reload. A 390px-wide layout was inspected. Opening a mobile thread retained feed scroll position, so thread navigation now scrolls to the top and uses a compact room header. That navigation adjustment still needs a final mobile interaction recheck.

## Live Firebase verification

After Mustafa confirmed publishing the rules, tested the actual configured cloud project using two temporary email/password accounts and the app's Firebase service functions:

- Account creation and profile creation succeeded.
- Lecturer created a room; student joined it.
- Student posted an anonymous question; the lecturer's real-time listener received it.
- A server read confirmed persistence, a resolved server timestamp, and no public author UID.
- Lecturer posted a response; the student's real-time listener received it.
- Voting and lecturer marking a question answered succeeded.
- Lecturer access to the student's private authorship record was denied.
- Student attempts to change lecturer-only answered status were denied.
- Closing the room blocked further responses.

The test room `ZHUVST`, titled `QA verification · 26 Oct 2026`, was closed after testing. Both temporary Auth accounts were deleted. The labeled QA documents remain because the app rules intentionally do not permit document deletion. Existing group data was not changed.

The local server at http://localhost:8097 was restarted in cloud mode and the browser refreshed. The sign-in screen appeared without the local-demo banner. Emulator demo accounts are separate from cloud accounts; use a real project account or the app's Create an account flow.

## Limits

The live service flow was verified with the Firebase client SDK; the full signed-in browser flow was exercised against emulators. No load test, screen-reader audit, or native device interaction test was performed. Rules behavior was tested rather than downloading the deployed rules source for an exact comparison. No PR was opened and no implementation was pushed.
