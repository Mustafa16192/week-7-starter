import { getAuth } from 'firebase/auth';
import { app } from './firebase';

// Browser Auth uses local persistence; native initialization is in auth.native.ts.
export const auth = app ? getAuth(app) : null;
