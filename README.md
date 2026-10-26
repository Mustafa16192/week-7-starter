# Classroom Q&A — DLM Week 7

A classroom question-and-answer app built with Expo, Firebase Authentication, and Cloud Firestore. Students join a lecture or assignment room, ask questions, upvote shared concerns, and respond. The room creator is its lecturer.

**Group 2:** Jessica Linn Donoho, Qier Long, Mustafa Ali Mirza.

## Features

- Email/password accounts, a display name, and restored sign-in sessions.
- Create rooms or join using a six-character code; revisit joined rooms.
- Live questions, flat named replies, vote counts, and answered status.
- Optional anonymous questions. Other participants, including the lecturer, cannot read the private authorship records through the client SDK.
- One removable upvote per person per question; newest/popular sorting and answered filters.
- Lecturer badges on replies, lecturer-only answered controls, and close/reopen controls.
- Closed rooms remain readable to existing members and reject new joins and content changes.
- Responsive desktop feed/thread layout and a separate thread view on narrow screens.
- Loading, empty, pending, validation, success, connection, and permission-error states.

## Setup

Use Node 22 and npm. The reference exercise is [Jessica’s Firebase introduction](https://github.com/jessicadonoho/jd-firebase-intro). This repository follows its Expo + Firebase service approach, with Expo SDK 58 and Firebase 12.6.0.

```sh
npm ci
cp .env.example .env  # only if you do not already have a local .env
npm run web
```

Fill in your own `.env` values before starting. Never overwrite a teammate’s existing `.env`. Restart Expo after configuration changes. `npm start`, `npm run ios`, and `npm run android` are also available; use an Expo Go version compatible with SDK 58. The primary tested experience is Expo web.

### Environment variables

| Variable | Firebase web configuration field |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | `appId` |
| `EXPO_PUBLIC_USE_EMULATORS` | Optional; `true` uses the isolated local demo project |
| `EXPO_PUBLIC_EMULATOR_HOST` | Optional; defaults to `localhost` |

Analytics, Storage, and Messaging are not used. `measurementId` is unnecessary. The bucket and sender values are retained from the standard Firebase web config.

`.env` and all variants are ignored; only the placeholder `.env.example` is tracked. Expo embeds public environment variables in client bundles. They are configuration, not secret storage. Never put service account credentials, Admin SDK credentials, or private API tokens in them. Access control is enforced by Firebase Auth and Firestore rules.

### Configure your cloud project

1. Register a Firebase web app and copy its configuration into `.env`.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create the default **Cloud Firestore** database. Start with restricted rules, then deploy the rules supplied here.
4. Publish `firestore.rules` in the Firebase Console, or use the Firebase CLI:

   ```sh
   npx firebase login
   npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
   ```

5. If this is an existing project, review and merge its rules before deployment. Do not erase rules for unrelated applications or leave an overlapping allow-all rule in place.
6. Ensure your web host is an authorized Firebase Auth domain when needed.
7. Set `EXPO_PUBLIC_USE_EMULATORS=false` (or omit it), restart Expo, and test with two separate browser sessions.

The app creates its documents when users register, create rooms, and post. No manual collection seeding is necessary. Queries use direct document reads or a single `createdAt` order; no composite indexes are required. `firestore.indexes.json` records this explicitly.

## Run the local demo

The local demo uses real Firebase Auth and Firestore **emulators**, with the same application services and security rules. It does not connect to the configured cloud project. Install Java 21 and make it available on your PATH for the Firestore emulator.

In terminal 1:

```sh
npm run emulators
```

In terminal 2:

```sh
npm run seed:demo
npm run demo
```

The demo opens at `http://localhost:8097`. The seed command prints its room code. Demo-only credentials:

| Role | Email | Password |
| --- | --- | --- |
| Lecturer | `lecturer@classroom.test` | `LearnTogether123!` |
| Student | `student@classroom.test` | `LearnTogether123!` |

These accounts exist only in the local emulator. You can also register new local demo accounts. Use separate browser profiles/private windows to sign in as different users. On this computer, `localhost:8097` and `127.0.0.1:8097` also provide separate browser-origin sessions.

Emulator data is temporary and is lost when the emulators stop unless you explicitly export it. Run the seed command again after a fresh start. Rules tests clear their demo Firestore data: finish testing before seeding a demo you want to keep.

For native device emulator testing, set `EXPO_PUBLIC_EMULATOR_HOST` to your computer’s LAN IP and configure emulator host binding appropriately. Cloud mode does not require the local emulators.

## Firestore model

| Path | Fields and use |
| --- | --- |
| `profiles/{uid}` | `displayName`; private to the account |
| `sessions/{code}` | `title`, `description`, `lecturerId`, `lecturerName`, `status`, `createdAt` |
| `sessions/{code}/members/{uid}` | `joinedAt`; own membership only |
| `users/{uid}/rooms/{code}` | `joinedAt`; private room history |
| `sessions/{code}/questions/{id}` | `text`, `authorName`, `anonymous`, `answered`, `createdAt` |
| `users/{uid}/authored/{code}_{questionId}` | `sessionId`, `questionId`, `createdAt`; private authorship |
| `sessions/{code}/questions/{id}/responses/{id}` | `text`, `authorName`, `authorId`, `createdAt` |
| `sessions/{code}/questions/{id}/votes/{uid}` | `createdAt`; document ID enforces one vote per user |

Creation times use server timestamps. The UI displays “Sending…” while timestamps or writes are pending. Question text and replies are trimmed and limited to 1,000 characters; names to 50, room titles to 100, and descriptions to 500.

Room creation and joining use transactions. Anonymous question creation and the private authorship record are an atomic batch. Votes use a transaction so rapid or concurrent attempts cannot create extra votes for the same account. Reply counts and vote counts are derived from live documents at classroom-demo scale.

Auth observers and Firestore listeners return cleanup functions. Room changes and sign-out stop listeners; listeners for individual questions are removed when no longer needed.

## Security and limitations

Rules enforce authentication, room membership, author identity, text limits, immutable question content, lecturer controls, and closed-room restrictions. A signed-in person who knows a valid room code can read its title/description and join while open; session enumeration and nonmember question reads are denied. A code is a classroom invitation, not verified course enrollment.

Anonymous question documents do not contain an author UID/email. Private authorship is readable only by the author, including when the requester is the lecturer. Firebase project administrators can still inspect underlying data. Named replies reveal their author; a lecturer badge identifies the room’s creator, not an institutionally verified faculty member.

This is a classroom prototype. Review rules and abuse protections before public deployment. Invitations with verified enrollment, moderation, editing/deleting content, multiple lecturers, password reset, email verification, attachments, notifications, and nested replies are outside this version. Display names are chosen by users and are not unique or verified.

The app reads the full question feed and maintains response/vote listeners for each question to keep counts exact. This is appropriate for the class demo; larger deployments need pagination and carefully maintained aggregate counts. Network failures preserve form text; a write interrupted after submission may stay pending until connectivity returns. Full offline editing is not a supported workflow.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
```

`test:rules` starts a Firestore emulator on port 8088 and uses the isolated `demo-dlm-week7` project. Stop an existing emulator first, or run `node --import tsx --test tests/rules.test.ts` against the running local emulator. It never loads the cloud `.env` configuration. Rules tests cover permission attacks, anonymous authorship, votes, closed rooms, multi-client snapshots, and cleanup. See [QA notes](docs/QA.md) for actual results and untested areas.

## Documentation and project status

- [PRD](docs/PRD-classroom-qa.md)
- [Implementation and process notes](docs/process-classroom-qa.md)
- [Original class starter instructions](docs/README.md)

The earlier task-board prototype was discarded. Its upstream PR is closed. This Q&A implementation should be reviewed locally before a PR is created or reopened at Mustafa’s request.

AI assistance: Mustafa supplied the requirements, Firebase configuration, reference repository, and product decisions. Codex assisted with implementation and testing. Individual teammate implementation contributions are not assumed.
