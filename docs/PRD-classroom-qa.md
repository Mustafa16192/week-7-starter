# Classroom Q&A — Product Requirements Document

## Summary
A small classroom Q&A app for SI 669. Students join a lecture or assignment room, post questions, upvote shared concerns, and respond. Firestore delivers live updates; Firebase Authentication identifies participants.

## Team
Group DLM: Jessica Linn Donoho, Qier Long, Mustafa Ali Mirza. The group supplies and maintains the Firebase project. Mustafa provided product decisions and approved implementation. Specific teammate implementation roles will be recorded when confirmed.

## Background
Students need a way to ask without interrupting a lecturer, contribute during assignments, and recognize questions shared by classmates. Anonymous questions can reduce hesitation; votes help prioritize class concerns. The original task-board prototype was removed before this app was planned.

## Objectives
Demonstrate Firebase Auth, persistent database storage, and real-time updates in a coherent, accessible classroom workflow. A lecturer and student on separate clients should see questions, replies, votes, and answered status update without refreshing (target: within three seconds on a stable connection). Saved content should survive a reload. The process documentation should explain decisions, prompts, iterations, and observed test results.

## Users
Any registered user can create a room and becomes its lecturer. People joining that room are students. Roles are per room, not global. Participants use a display name and email/password account. Questions may be anonymous to other participants, including the lecturer; replies are always named. Firebase project administrators are outside this anonymity boundary.

## Value
Students can ask comfortably and help peers. Lecturers can see common questions and track explanations already given. The app supports both live lectures and ongoing assignment conversations with one simple room model.

## Solution and acceptance criteria

### Accounts and rooms
- Register, sign in, create a display name, and sign out. Restore the authenticated session on reload.
- Create a room with a required title (100 characters maximum) and optional context (500 maximum).
- Generate a unique six-character code. Joining by code persists membership and adds the room to My rooms.
- Only the creator has lecturer controls. Closed rooms reject new joins but remain readable to existing members.
- The lecturer can close and reopen rooms. Closed rooms block question, response, vote, and answered-state writes at the database layer.

### Questions
- Require and trim question text, up to 1,000 characters. Preserve drafts after errors and block repeat submissions while pending.
- Optional anonymous posting is chosen for each question. Public records must not expose author identity for anonymous questions. Authors can recognize their own questions.
- Show author label, readable creation time, response count, vote count, and answered status.
- Default to newest first. Offer most-upvoted sorting and All/Unanswered/Answered filters with deterministic tie ordering.
- Allow one removable upvote per account. Only the lecturer can mark/unmark answered, including after a spoken answer.

### Responses
- Open a question to read its flat chronological thread and submit a named reply, up to 1,000 trimmed characters.
- Show a lecturer badge only for responses authored by that room’s creator.
- Responses and counts update live. Unresolved server timestamps render safely.

### Interface
- Original light design with navy text and indigo actions; no copied Slido assets.
- Desktop feed and thread side by side; narrow screens use a separate thread view and back action.
- Clear loading, empty, validation, pending, success, connection, and permission-error states.
- Associated field labels, meaningful control names, visible keyboard focus, disabled states, and no state indicated by color alone.

### Technical approach
Expo/React Native with web support, Firebase modular SDK, Firestore server timestamps and snapshot subscriptions. Separate initialization, services, hooks, and presentation. No custom backend or Analytics. Use ignored `.env` values with a placeholder `.env.example`. The group deploys the provided Firestore rules to its project.

Public questions and private author records are written atomically. Room membership and vote changes use transactions. Private data must remain private even when a client bypasses the UI. The README specifies collections, rules, configuration, commands, and limitations.

## Release and verification
Build accounts/rooms first, then live questions/replies/votes, then lecturer controls and responsive polish. Verify two-client updates, reload persistence, invalid submissions, access denial, anonymity, duplicate votes, close/reopen behavior, and subscription cleanup. Run lint, TypeScript, unit tests, emulator rule tests, and production export. Distinguish local-emulator evidence from cloud-project and native-device evidence.

Deferred: attachments, nested threads, notifications, polls, editing/deleting content, moderation, institutional verification, multiple lecturers, and full offline editing. The prototype favors understandable course-scale data flows over production-scale aggregation.

Review the running app with Mustafa before opening or reopening an upstream PR. No Canvas submission is automated.
