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
    },
    anonymousData: true,
    sensorSensitivity: 'Média',
    retractionDelay: 3,
    city: 'São Paulo',
    location: { latitude: -23.5505, longitude: -46.6333, name: 'São Paulo' },
  },
};

export const LEGACY_VARAL_ID = 'legacy';

export function isRealHistoryEvent(event) {
  const marker = `${event?.mode || ''} ${event?.source || ''} ${event?.action || ''}`;
  return Number.isFinite(event?.timestamp)
    && typeof event.isOpen === 'boolean'
    && !/(?:demo|demonstra|simulad[oa]?)/i.test(marker);
}

function dataPath(varalId, path = '') {
  const prefix = varalId && varalId !== LEGACY_VARAL_ID ? `varais/${varalId}` : '';
  return [prefix, path].filter(Boolean).join('/');
}

export function subscribeToUserData(uid, onData, onError) {
  return onValue(
    ref(database, userPath(uid)),
    (snapshot) => onData(snapshot.val() || {}),
    onError,
  );
}

export function saveUserData(uid, path, value, varalId = LEGACY_VARAL_ID) {
  return set(ref(database, userPath(uid, dataPath(varalId, path))), value);
}

export function updateUserData(uid, path, values, varalId = LEGACY_VARAL_ID) {
  return update(ref(database, userPath(uid, dataPath(varalId, path))), values);
}

export function createVaral(uid, varalId, value) {
  return update(ref(database, userPath(uid)), {
    [`varais/${varalId}`]: value,
    'settings/activeVaralId': varalId,
  });
}

export function deleteVaral(uid, varalId, nextActiveVaralId) {
  return update(ref(database, userPath(uid)), {
    [`varais/${varalId}`]: null,
    'settings/activeVaralId': nextActiveVaralId,
  });
}

export function updateVaralProfile(uid, varalId, { name, deviceId, location }) {
  const updates = varalId && varalId !== LEGACY_VARAL_ID
    ? {
      [`varais/${varalId}/name`]: name,
      [`varais/${varalId}/deviceId`]: deviceId,
      [`varais/${varalId}/location`]: location,
      [`varais/${varalId}/settings/location`]: location,
      [`varais/${varalId}/settings/city`]: location.name,
      [`varais/${varalId}/device/id`]: deviceId,
    }
    : {
      'device/name': name,
      'device/id': deviceId,
      'settings/location': location,
      'settings/city': location.name,
    };
  return update(ref(database, userPath(uid)), updates);
}

export function selectVaral(uid, varalId) {
  return saveUserData(uid, 'settings/activeVaralId', varalId);
}

export async function issueVaralCommand(uid, isOpen, source = 'manual', varalId = LEGACY_VARAL_ID) {
  const commandRef = ref(database, userPath(uid, dataPath(varalId, 'device/command')));
  const command = {
    commandId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    isOpen,
    source,
    createdAt: Date.now(),
    status: 'pending',
  };
  await set(commandRef, command);
}
