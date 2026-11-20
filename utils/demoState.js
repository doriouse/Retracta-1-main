import AsyncStorage from '@react-native-async-storage/async-storage';

const stateKey = (uid, name) => `@retracta/demo/${uid}/${name}`;

export async function loadDemoValue(uid, name, fallback) {
  const value = await AsyncStorage.getItem(stateKey(uid, name));
  return value === null ? fallback : JSON.parse(value);
}

export function saveDemoValue(uid, name, value) {
  return AsyncStorage.setItem(stateKey(uid, name), JSON.stringify(value));
}

export async function loadMaintenanceAppointments(uid) {
  return loadDemoValue(uid, 'maintenance', []);
}

export function saveMaintenanceAppointments(uid, appointments) {
  return saveDemoValue(uid, 'maintenance', appointments);
}

export async function appendDemoHistoryEvent(uid, event) {
  const history = await loadDemoValue(uid, 'history', []);
  const next = [...history, {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }];
  await saveDemoValue(uid, 'history', next);
}
