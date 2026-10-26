import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

export const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
export const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost';
const suppliedConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const missingConfig = Object.entries(suppliedConfig)
  .filter(([, value]) => !value || value.startsWith('your_') || value.includes('replace_with'))
  .map(([key]) => key);
const config = useEmulators ? {
  apiKey: 'demo-local-only', authDomain: 'demo-dlm-week7.firebaseapp.com',
  projectId: 'demo-dlm-week7', appId: 'demo-classroom-app',
} : suppliedConfig;
const existing = getApps().length > 0;
export const app = useEmulators || missingConfig.length === 0 ? (existing ? getApp() : initializeApp(config)) : null;
export const db = app ? getFirestore(app) : null;
if (db && useEmulators && !existing) connectFirestoreEmulator(db, emulatorHost, 8088);
