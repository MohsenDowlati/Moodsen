import type { User, MoodEntry, AppNotification, ReminderSettings } from './types';

const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return (await res.json()) as T;
}

export async function apiSignUp(full_name: string, email: string, password: string) {
  return request(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ full_name, email, password }),
      },
  );
}

export async function apiSignIn(email: string, password: string) {
  return request(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
  );
}

export async function apiSignOut(): Promise<void> {
    return request(
        '/auth/logout',
        {
            method: 'POST',
        }
    )
}

export async function apiGetSession() {
  return request<{ user: User; entries: MoodEntry[]; notifications: AppNotification[] }>('/auth/me');
}

export async function apiSaveMood(entry: { date: string; mood: string; note: string }) {
  return request<MoodEntry>('/moods/today', { method: 'POST', body: JSON.stringify(entry) });
}

export async function apiDeleteEntry(id: string) {
  return request<void>(`/moods/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function apiGetNotifications() {
  return request<AppNotification[]>('/notifications');
}

export async function apiMarkNotificationRead(id: string) {
  return request<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function apiUpdateReminderSettings(settings: Partial<ReminderSettings>) {
  return request<ReminderSettings>('/settings/reminder', { method: 'POST', body: JSON.stringify(settings) });
}
