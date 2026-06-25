import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_KEY = '@decide/reminder_time';

export async function requestPermissions() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Decide',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  return status === 'granted';
}

export async function scheduleDailyReminder(hour, minute) {
  await cancelDailyReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: "Time to Decide!",
      body: "What's the plan for today? Tap to start your day.",
      data: { screen: '/(tabs)/plan' },
    },
    trigger: {
      type: 'daily',
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ hour, minute }));
}

export async function cancelDailyReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync('daily-reminder');
  } catch {}
  await AsyncStorage.removeItem(REMINDER_KEY);
}

export async function scheduleItineraryAlerts(itinerary) {
  await cancelItineraryAlerts();

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let i = 0; i < itinerary.length; i++) {
    const stop = itinerary[i];
    const stopMinutes = parseTime(stop.time);
    const alertMinutes = stopMinutes - 30;
    if (alertMinutes <= currentMinutes) continue;

    const alertDate = new Date();
    alertDate.setHours(Math.floor(alertMinutes / 60), alertMinutes % 60, 0, 0);

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `stop-${i}`,
        content: {
          title: `Coming up: ${stop.name}`,
          body: `${stop.time} — ${stop.category} (${stop.duration_mins} min)`,
          data: { screen: '/(tabs)/plan', stopIndex: i },
        },
        trigger: { type: 'date', date: alertDate },
      });
    } catch {}
  }
}

export async function cancelItineraryAlerts() {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier.startsWith('stop-')) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {}
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function loadReminderTime() {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [time, period] = timeStr.split(' ');
  const [h, m = '0'] = time.split(':');
  let hour = parseInt(h, 10);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + parseInt(m, 10);
}
