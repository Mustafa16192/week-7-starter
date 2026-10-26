# Common Ground — DLM Week 7

A small shared task board built with Expo and Firebase for SI 669, In Class 7 Part 2.

**Group 2:** Jessica Linn Donoho, Qier Long, Mustafa Ali Mirza.

Create an account, add a task, and check it off together. Changes appear on other signed-in clients without refreshing. Filter the board by All, Open, or Done. Only the person who created a task can delete it.

## Assignment artifacts

- [Process documentation — DLM-week7](https://docs.google.com/document/d/1M8E3EuWza5_kyurq_6rJ0kWZMs2QGRfMJ-M4N_6gksg/edit)
- [Team fork](https://github.com/Mustafa16192/week-7-starter)
- Upstream PR: will be added after the first validated build.

## How Firebase is used

| Requirement | Implementation |
| --- | --- |
| Authentication | Email/password registration and sign-in; `onAuthStateChanged` gates the board. Browser sessions use Firebase local persistence; native sessions use AsyncStorage through Firebase Auth. Sign-out removes access and unmounts the board listener. |
| Database storage | Cloud Firestore stores tasks in `dlmWeek7Tasks`, using server timestamps. No task data is stored only in React state. |
| Real-time updates | `onSnapshot` subscribes to the task query. Creation, completion, and deletion arrive on other clients immediately without polling or manual refresh. The subscription is cleaned up when the board unmounts. |

Cloud Firestore provides both storage and real-time updates; the separate Firebase Realtime Database product is not needed. The app does not initialize Analytics or use OpenRouter.

## Local setup

Use Node 22 (see `.nvmrc`) and an Expo Go version compatible with Expo SDK 58. If using nvm, run `nvm use`.

```sh
npm ci
cp .env.example .env.local
# Fill in .env.local from Firebase Console → Project settings → Your apps → Web app.
npm start
```

Open Expo Go and scan the QR code, or run `npm run web` for the browser. Both clients must use the same Firebase project to share a board. No Snack URL is provided: this project runs from the repository and needs local environment configuration.

### Environment variables

The group’s configured Firebase project is `project-cdb19`. Ask the project owner for its web-app configuration, or use your own project. Actual values are intentionally omitted from the repository.

| Variable | Firebase configuration field |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | `appId` |

The storage bucket and messaging sender are retained from the standard Firebase web configuration; this app does not use Storage or Messaging. `measurementId` is not needed because Analytics is not used. Restart Expo after changing the environment.

`.env` and `.env.*` are ignored; `.env.example` contains placeholders. Expo embeds `EXPO_PUBLIC_*` values into client bundles, so these variables are **not secret storage**. Firebase client configuration identifies the project; Authentication and Firestore rules enforce access. Never put service-account keys, admin credentials, or private API tokens in the client.

### Firebase console setup

1. Register a web app in your Firebase project and copy its configuration into `.env.local`.
2. Under Authentication → Sign-in method, enable **Email/Password** (passwordless email links are not used).
3. Create the default Cloud Firestore database in Standard edition, initially in Production mode. The group project uses the free Spark plan.
4. Publish `firestore.rules` in Firestore → Rules. For an existing project with other rules, merge only the `dlmWeek7Tasks` block into its existing documents match; do not erase unrelated collection rules. Ensure no broader allow-all rule overrides these restrictions.
5. If needed, add the web host to Authentication → Settings → Authorized domains. Use `localhost` for local web development.

The provided rules require sign-in for reads and writes, allow only valid new tasks owned by the creator, allow teammates to change only completion, and restrict deletion to the creator. This is **one classroom board shared by every registered user of the project**, not an invitation-only workspace. Use it for non-sensitive class tasks.

Each task contains `title` (1–140 characters with non-whitespace content), `completed` (boolean), `createdBy` (Firebase UID), and `createdAt` (server timestamp). UI-only `id` and `pending` values are derived from snapshots.

## Demonstrate the app

1. Open the app on two devices, or a normal and private browser window, with the same project configuration.
2. Create two separate accounts. Add a task on client A; it appears on client B without refreshing.
3. On B, mark the task complete. A updates automatically; the task appears under Done on both clients.
4. B has no delete action for A’s task. A can delete it after confirmation; it disappears on B.
5. Add another task and restart the app. Confirm the session restores and the task remains. Sign out and confirm the board is hidden.

## Checks

```sh
npm run typecheck
npm run lint
npm run export:web
npm run test:firebase
```

`test:firebase` runs against the configured **class/test project** with deployed rules. It creates two disposable `dlm-qa-*` accounts and `qa-*` tasks, checks live updates and authorization, and removes its own fixtures. It does not require admin credentials. Do not run it against an unrelated production project.

Validation results and limitations are maintained in the process document. The UI distinguishes pending writes from confirmed changes, preserves the task composer after errors, and provides a reconnect action for failed subscriptions. Full offline editing, password reset, invitations, and task-title editing are outside this prototype.

## AI use and references

Mustafa supplied requirements and project configuration and approved the scope. Codex assisted with planning, implementation, setup, testing, and documentation. Individual teammate contributions are recorded only when confirmed in the process doc.

- [Expo starter instructions](docs/README.md)
- [Expo: Using Firebase](https://docs.expo.dev/guides/using-firebase/)
- [Firebase Authentication](https://firebase.google.com/docs/auth/web/start)
- [Firestore live listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firestore rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
