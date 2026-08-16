export type MoodId =
  | 'joyful'
  | 'calm'
  | 'motivated'
  | 'neutral'
  | 'anxious'
  | 'sad'
  | 'angry';

export interface Mood {
  id: MoodId;
  label: string;
  emoji: string;
  /** Tailwind text color class for the emoji/icon */
  color: string;
  /** Tailwind background tint class (soft) */
  bg: string;
  /** Solid gradient classes for selection state */
  gradient: string;
  /** Hex/rgb used by the chart */
  chart: string;
  /** Numeric score 1 (worst) – 7 (best) for trend chart */
  score: number;
  description: string;
}

export interface MoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: MoodId;
  note: string;
  createdAt: string; // ISO
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  joinedAt: string; // ISO
}

export type ViewId = 'today' | 'history' | 'insights' | 'profile';

export type NotificationKind = 'reminder' | 'streak' | 'info';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  date: string; // YYYY-MM-DD
  read: boolean;
  createdAt: string; // ISO
}

export interface ReminderSettings {
  enabled: boolean;
  hour: number; // 0-23, the hour to deliver the reminder
}
