import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { app, emulatorHost, useEmulators } from './config';
export const auth = app ? getAuth(app) : null;
if (auth && useEmulators && !auth.emulatorConfig) connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
