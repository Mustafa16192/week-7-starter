# DLM Week 7 — Classroom Q&A process record

## Product reset and scope
Mustafa asked to discard the previous task-board prototype. The fork was restored to the original starter file tree, preserving Git history. The earlier upstream PR was closed. The replacement concept is a Slido-inspired classroom Q&A app.

## Vision questions and confirmed answers
1. Room access: join a room using a code.
2. Identity: an account plus optional anonymous questions.
3. Replies: everyone can reply; lecturer replies receive a badge.
4. Priority: one upvote per person plus newest/popular sorting.
5. Anonymous identity: hidden from students and the lecturer; authors recognize their own posts.
6. Answered status: the lecturer marks a question answered, including when answered aloud.
7. Room lecturer: the creator is the lecturer; roles are local to a room.
8. Room lifetime: closed rooms remain read-only.
9. Discussion format: flat named replies.

The subsequent implementation brief allowed a smaller guest-based flow. We clarified the conflict, and Mustafa explicitly selected “Keep agreed vision.”

## Prompting approach
Mustafa supplied the assignment, the Firebase web configuration, Jessica’s reference repository, a detailed functionality/accessibility brief, and then “implement the plan.” The agreed PRD was used as the implementation checklist. No new product features were invented to demonstrate AI capabilities; OpenRouter and Analytics are unused.

## Technical and design decisions
- Follow the reference exercise’s Expo + Firebase service structure, with Firebase initialization and data access separate from screen components.
- Use the existing class fork; it was empty of app code after the reset, so there was no working infrastructure to preserve.
- Use the Firebase emulator suite to demonstrate and verify behavior before the group deploys cloud rules.
- Keep anonymous authorship in private per-user records. Simply hiding a name in the UI would not meet the agreed privacy behavior.
- Use transactions for room membership and votes, and an atomic batch for question/authorship creation.
- Derive exact reply/vote counts from live documents for this small classroom demo; record the scaling tradeoff explicitly.
- Give question text the main visual emphasis. Room context and a visible code sit above the feed. Desktop supports side-by-side reading; phones use a focused thread view.
- Use explicit pending/error/success states and preserve text on failed writes.

## Implementation iterations — October 26, 2026
- Re-inspected the clean starter and Jessica’s Firebase Auth/Firestore examples before implementation.
- Created an Expo project with environment-based Firebase configuration, service functions, and room-aware security rules.
- Added account/profile flows, room list and join/create forms, live question threads, votes, answered state, and room close/reopen controls.
- The first dependency installation ran out of disk space and left incomplete packages. Removed generated files from the discarded prototype, then performed a clean reinstall. No user source or saved Firebase configuration was deleted.
- Corrected rule validation to accept multi-line questions while still rejecting whitespace-only text.
- Emulator testing verified anonymous-author privacy, lecturer-only actions, room isolation, one-vote constraints, and read-only rooms using direct SDK attempts that bypass UI controls.

## Evidence and attribution
Actual test commands and outcomes are maintained in QA.md. Firebase emulator results do not imply successful deployment or testing against the group’s cloud project. Jessica’s and Qier’s individual implementation contributions are not assumed; add confirmed work to the shared process doc.

The PR remains closed pending Mustafa’s local review. The group is responsible for submitting the final PR and process-document links on Canvas.

## Live-project follow-up — October 26, 2026
Mustafa published the Firestore rules in the shared Firebase project. A two-account cloud check then confirmed authentication, room creation/joining, question and response persistence, live updates, votes, lecturer permissions, anonymous-author privacy, and closed-room behavior. Temporary Auth accounts were removed; the labeled QA room was closed. The local web server was switched from emulators to the group's cloud configuration. See QA.md for evidence and remaining testing limits.

Mobile inspection also identified retained feed scroll when entering a thread. Navigation now scrolls to the top and presents a compact header. TypeScript caught a React Native scroll-ref type mismatch introduced during that change; the ref now uses the component's actual instance type.
