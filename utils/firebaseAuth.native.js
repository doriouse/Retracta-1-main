import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, getReactNativePersistence, initializeAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { app } from '../firebaseConfig';

let auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch (error) {
  if (error.code !== 'auth/already-initialized') throw error;
  auth = getAuth(app);
}

export { auth };

export function setRememberMe(enabled) {
  return setPersistence(auth, enabled ? getReactNativePersistence(AsyncStorage) : inMemoryPersistence);
}
