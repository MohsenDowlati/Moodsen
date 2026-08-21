import type {
    User,
    MoodEntry,
    AppNotification,
    ReminderSettings,
    MoodEntryResponse,
    MoodStatisticsResponse, MoodEntryCreateOrUpdate, MoodEntryUpdate, PaginatedMoodEntriesResponse
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

function getCookie(name: string): string | null {
    const value = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`))
        ?.split('=')[1];

    return value ? decodeURIComponent(value) : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const headers = new Headers(options.headers);

    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfToken = getCookie('csrf_token');
        if (csrfToken) {
            headers.set('X-CSRF-Token', csrfToken);
        }
    }

    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            if (typeof body?.detail === 'string') detail = body.detail;
        } catch {
            // Keep the HTTP status when the server did not return JSON.
        }
        throw new Error(detail);
    }
    if (res.status === 204) return undefined as T;
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
  return request<{ user: User; entries: MoodEntry[]; notifications: AppNotification[] }>('/me');
}

export async function apiSaveMood(
    entry: MoodEntryCreateOrUpdate,
): Promise<MoodEntryResponse> {
    return request<MoodEntryResponse>('/moods/today', {
        method: 'POST',
        body: JSON.stringify(entry),
    });
}

export async function apiGetMood(): Promise<MoodEntryResponse | null> {
    return request<MoodEntryResponse | null>('/moods/today');
}

export async function apiGetLastWeekMood(
    days = 7,
): Promise<MoodEntryResponse[]> {
    return request<MoodEntryResponse[]>(`/moods/recent?days=${days}`);
}

export async function apiGetMonthMood(
    year: number,
    month: number,
): Promise<MoodEntryResponse[]> {
    return request<MoodEntryResponse[]>(`/moods/month/${year}/${month}`);
}

export async function apiStatisticsAllTimeMood(): Promise<MoodStatisticsResponse> {
    return request<MoodStatisticsResponse>('/moods/statistics');
}

export async function apiStatisticsRecentMood(
    days = 30,
): Promise<MoodStatisticsResponse> {
    return request<MoodStatisticsResponse>(`/moods/statistics/recent?days=${days}`);
}

export async function apiStatisticsMonthMood(
    year: number,
    month: number,
): Promise<MoodStatisticsResponse> {
    return request<MoodStatisticsResponse>(`/moods/statistics/month/${year}/${month}`);
}

export async function apiGetAllMoodEntries(
    page = 1,
    pageSize = 20,
): Promise<PaginatedMoodEntriesResponse> {
    return request<PaginatedMoodEntriesResponse>(
        `/moods/?page=${page}&page_size=${pageSize}`,
    );
}

export async function apiGetMoodById(id: string): Promise<MoodEntryResponse> {
    return request<MoodEntryResponse>(`/moods/${id}`);
}

export async function apiUpdateMoodById(
    id: string,
    entry: MoodEntryUpdate,
): Promise<MoodEntryResponse> {
    return request<MoodEntryResponse>(`/moods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(entry),
    });
}



export async function apiDeleteEntry(id: string) {
  return request<void>(`/moods/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function apiGetNotifications() {
  const response = await request<{ items: Array<{
    id: string;
    category: 'reminder' | 'streak_milestone' | 'system';
    title: string;
    message: string;
    read_at: string | null;
    created_at: string;
  }> }>('/notifications');
  return response.items;
}

export async function apiMarkNotificationRead(id: string) {
  return request<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export async function apiMarkAllNotificationsRead() {
  return request<{ updated_count: number }>('/notifications/read-all', { method: 'PATCH' });
}

export async function apiUpdateReminderSettings(settings: Partial<ReminderSettings>) {
  return request<ReminderSettings>('/settings/reminder', { method: 'POST', body: JSON.stringify(settings) });
}
