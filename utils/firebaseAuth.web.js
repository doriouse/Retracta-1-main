import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import { app } from '../firebaseConfig';

export const auth = getAuth(app);

export function setRememberMe(enabled) {
  return setPersistence(auth, enabled ? browserLocalPersistence : browserSessionPersistence);
}
