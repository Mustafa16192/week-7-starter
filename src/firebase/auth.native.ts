import AsyncStorage from '@react-native-async-storage/async-storage';
// Firebase's native entrypoint exports persistence; the default web types omit it.
// @ts-expect-error Metro resolves the React Native export on iOS and Android.
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { app, emulatorHost, useEmulators } from './config';
function initialize() {
  if (!app) return null;
  try { return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); }
  catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized') return getAuth(app);
    throw error;
  }
}
export const auth = initialize();
if (auth && useEmulators && !auth.emulatorConfig) connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
