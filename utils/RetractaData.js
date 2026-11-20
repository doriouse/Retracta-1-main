import {
  onValue,
  ref,
  set,
  update,
} from 'firebase/database';
import { database } from '../firebaseConfig';

const userPath = (uid, path = '') => `users/${uid}${path ? `/${path}` : ''}`;

export const DEFAULT_USER_DATA = {
  device: { smartMode: true, autoReopen: true },
  schedules: [],
  history: [],
  settings: {
    notifications: {
      rain: true,
      schedules: true,
      status: false,
      maintenance: true,
    },
    anonymousData: true,
    sensorSensitivity: 'Média',
    retractionDelay: 3,
    city: 'São Paulo',
    location: { latitude: -23.5505, longitude: -46.6333, name: 'São Paulo' },
  },
};

export function subscribeToUserData(uid, onData, onError) {
  return onValue(
    ref(database, userPath(uid)),
    (snapshot) => onData(snapshot.val() || {}),
    onError,
  );
}

export function saveUserData(uid, path, value) {
  return set(ref(database, userPath(uid, path)), value);
}

export function updateUserData(uid, path, values) {
  return update(ref(database, userPath(uid, path)), values);
}

export async function issueVaralCommand(uid, isOpen, source = 'manual') {
  const commandRef = ref(database, userPath(uid, 'device/command'));
  const command = {
    commandId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    isOpen,
    source,
    createdAt: Date.now(),
    status: 'pending',
  };
  await set(commandRef, command);
}
