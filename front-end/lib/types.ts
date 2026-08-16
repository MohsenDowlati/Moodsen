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


export interface MoodEntryResponse {
  id: string;
  user_id: string;
  mood: MoodId;
  note: string | null;
  entry_date: string;
  created_at: string;
}

export interface MoodEntryCreateOrUpdate {
  mood: MoodId;
  note?: string | null;
}

export interface MoodEntryUpdate {
  mood?: MoodId | null;
  note?: string | null;
}

export interface MoodStatisticsResponse {
  total_entries: number;
  current_streak: number;
  longest_streak: number;
  most_common_mood: MoodId | null;
  average_mood_score: number | null;
  best_weekday: string | null;
  mood_distribution: Record<string, number>;
}


export interface User {
  id: string;
  current_streak: number;
  daily_reminders_enabled: boolean;
  dark_mode_enabled: boolean;
  email: string;
  full_name: string;
  joined_at: string;
  longest_streak: number;
  reminder_time: string;
  updated_at: string;
}

export interface PaginatedMoodEntriesResponse {
  items: MoodEntryResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
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
