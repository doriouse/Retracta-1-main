import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const SCHEDULE_NOTIFICATION_IDS = '@retracta/notificationIds/schedules';

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  return permission.granted;
}

export async function sendLocalNotification(title, body) {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: null,
  });
  return true;
}

export async function syncScheduleNotifications(schedules, enabled, varalId = 'legacy') {
  const storageKey = varalId && varalId !== 'legacy'
    ? `${SCHEDULE_NOTIFICATION_IDS}/${varalId}`
    : SCHEDULE_NOTIFICATION_IDS;
  const previousIds = JSON.parse((await AsyncStorage.getItem(storageKey)) || '[]');
  await Promise.all(previousIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  if (!enabled) {
    await AsyncStorage.removeItem(storageKey);
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    await AsyncStorage.removeItem(storageKey);
    return;
  }

  const newIds = [];
  for (const schedule of schedules.filter((item) => item.active)) {
    const time = String(schedule.time || '').match(/(?:^|\D)([01]\d|2[0-3]):([0-5]\d)/);
    if (!time) continue;
    const days = Array.isArray(schedule.days) && schedule.days.length
      ? schedule.days
      : /útil|uteis|úteis/i.test(schedule.subtitle || '')
        ? [1, 2, 3, 4, 5]
        : /fim de semana|sábado|sabado/i.test(schedule.subtitle || '')
          ? [0, 6]
          : [0, 1, 2, 3, 4, 5, 6];
    for (const day of days) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Lembrete Retracta',
          body: `${schedule.title}: horário de ${schedule.action === 'close' ? 'recolher' : 'estender'} o varal.`,
          sound: 'default',
          data: { scheduleId: schedule.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: Number(day) + 1,
          hour: Number(time[1]),
          minute: Number(time[2]),
        },
      });
      newIds.push(id);
    }
  }
  await AsyncStorage.setItem(storageKey, JSON.stringify(newIds));
}
