import AsyncStorage from '@react-native-async-storage/async-storage';
// Firebase's default declarations omit this export, which is present in its React Native entrypoint.
// @ts-expect-error -- Metro resolves the native Firebase Auth entrypoint on iOS/Android.
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { app } from './firebase';

function nativeAuth() {
  if (!app) return null;
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized') return getAuth(app);
    throw error;
  }
}
export const auth = nativeAuth();
