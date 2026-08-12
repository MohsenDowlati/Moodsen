import type { AppNotification, MoodEntry, ReminderSettings } from './types';
import { todayISO, toISODate } from './dates';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  hour: 9, // 9 AM
};

let counter = 0;
function notifId(prefix: string): string {
  counter += 1;
  return `notif-${prefix}-${Date.now()}-${counter}`;
}

export function makeReminderNotification(
  date: string = todayISO(),
  userName?: string,
): AppNotification {
  const name = userName?.split(' ')[0];
  return {
    id: notifId('rem'),
    kind: 'reminder',
    title: name ? `Time to log your mood, ${name}` : 'Time to log your mood',
    body: 'Take a moment to reflect on how today went. A quick check-in helps you stay aware of patterns.',
    date,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

export function makeStreakNotification(
  streak: number,
  date: string = todayISO(),
): AppNotification {
  return {
    id: notifId('streak'),
    kind: 'streak',
    title: `${streak}-day streak! Keep it going`,
    body: `You've logged your mood ${streak} days in a row. Come add today's entry to keep the streak alive.`,
    date,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decide whether a reminder notification should be generated now.
 * Returns true if reminders are enabled, the current hour is at or past
 * the configured hour, and no reminder has been created yet today.
 */
export function shouldGenerateDailyReminder(
  settings: ReminderSettings,
  notifications: AppNotification[],
  now: Date = new Date(),
): boolean {
  if (!settings.enabled) return false;
  if (now.getHours() < settings.hour) return false;
  const today = toISODate(now);
  const hasTodayReminder = notifications.some(
    (n) => n.kind === 'reminder' && n.date === today,
  );
  return !hasTodayReminder;
}

/**
 * Decide whether a streak notification should be generated.
 * Returns true if the user has a streak of at least 3 days, hasn't logged
 * today yet, and no streak notification exists for today.
 */
export function shouldGenerateStreakNotification(
  entries: MoodEntry[],
  notifications: AppNotification[],
  now: Date = new Date(),
): boolean {
  const today = toISODate(now);
  const loggedToday = entries.some((e) => e.date === today);
  if (loggedToday) return false;

  const streak = computeStreakFromEntries(entries, now);
  if (streak < 3) return false;

  const hasTodayStreak = notifications.some(
    (n) => n.kind === 'streak' && n.date === today,
  );
  return !hasTodayStreak;
}

function computeStreakFromEntries(
  entries: MoodEntry[],
  now: Date = new Date(),
): number {
  const dates = new Set(entries.map((e) => e.date));
  let streak = 0;
  const cursor = new Date(now);
  const todayStr = toISODate(cursor);
  if (!dates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function sortNotifications(notifs: AppNotification[]): AppNotification[] {
  return [...notifs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function unreadCount(notifs: AppNotification[]): number {
  return notifs.filter((n) => !n.read).length;
}
