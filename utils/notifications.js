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

export async function syncScheduleNotifications(schedules, enabled) {
  const previousIds = JSON.parse((await AsyncStorage.getItem(SCHEDULE_NOTIFICATION_IDS)) || '[]');
  await Promise.all(previousIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  if (!enabled) {
    await AsyncStorage.removeItem(SCHEDULE_NOTIFICATION_IDS);
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    await AsyncStorage.removeItem(SCHEDULE_NOTIFICATION_IDS);
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
  await AsyncStorage.setItem(SCHEDULE_NOTIFICATION_IDS, JSON.stringify(newIds));
}

export async function scheduleMaintenanceReminder(appointment) {
  const date = new Date(appointment.date);
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  if (date.getTime() <= Date.now()) return null;
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Manutenção Retracta amanhã',
      body: `Lembrete de manutenção agendada para ${new Date(appointment.date).toLocaleDateString('pt-BR')}.`,
      data: { appointmentId: appointment.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

export async function cancelMaintenanceReminder(identifier) {
  if (identifier) await Notifications.cancelScheduledNotificationAsync(identifier);
}
