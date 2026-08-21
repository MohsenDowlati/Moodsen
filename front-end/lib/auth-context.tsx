'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import type {
    AppNotification,
    MoodEntry,
    MoodEntryResponse,
    MoodStatisticsResponse,
    ReminderSettings,
    User,
} from './types';
import { todayISO } from './dates';

import {
    DEFAULT_REMINDER_SETTINGS,
    sortNotifications,
    unreadCount,
} from './notifications';

import * as api from './api';

type AuthResponse = {
    user: User;
    entries?: MoodEntry[];
    notifications?: AppNotification[];
};

const STORAGE_KEY = 'moodsen.session.v1';
const SETTINGS_KEY = 'moodsen.reminder.v1';

interface StoredSession {
    user: User;
    entries: MoodEntry[];
    notifications: AppNotification[];
}

// ---- Wire (backend response) types ----

type MoodWireEntry = {
    id: string;
    user_id: string;
    mood: MoodEntry['mood'];
    note: string | null;
    entry_date: string;
    created_at: string;
};

type MoodWireStatistics = {
    total_entries: number;
    current_streak: number;
    longest_streak: number;
    most_common_mood: MoodEntry['mood'] | null;
    average_mood_score: number | null;
    best_weekday: string | null;
    mood_distribution: Record<string, number>;
};

type NotificationWire = {
    id: string;
    category: 'reminder' | 'streak_milestone' | 'system';
    title: string;
    message: string;
    read_at: string | null;
    created_at: string;
};

// ---- Mapping helpers (hoisted out of the component) ----

function mapMoodEntry(entry: MoodWireEntry): MoodEntry {
    return {
        id: entry.id,
        date: entry.entry_date,
        mood: entry.mood,
        note: entry.note ?? '',
        createdAt: entry.created_at,
    };
}

function mapMoodStatistics(stats: MoodWireStatistics): MoodStatisticsResponse {
    return stats;
}

function mapNotification(notification: NotificationWire): AppNotification {
    return {
        id: notification.id,
        kind: notification.category === 'streak_milestone' ? 'streak' :
            notification.category === 'reminder' ? 'reminder' : 'info',
        title: notification.title,
        body: notification.message,
        date: notification.created_at.slice(0, 10),
        read: Boolean(notification.read_at),
        createdAt: notification.created_at,
    };
}

function mapSessionEntries(entries: MoodWireEntry[] = []): MoodEntry[] {
    return entries.map(mapMoodEntry);
}

function mapSessionNotifications(
    notifications: NotificationWire[] = [],
): AppNotification[] {
    return notifications.map(mapNotification);
}

function reminderSettingsFromUser(currentUser: User): ReminderSettings {
    const hour = Number.parseInt(currentUser.reminder_time?.slice(0, 2) ?? '', 10);
    return {
        enabled: currentUser.daily_reminders_enabled,
        hour: Number.isFinite(hour) ? hour : DEFAULT_REMINDER_SETTINGS.hour,
    };
}

interface AuthContextValue {
    user: User | null;
    entries: MoodEntry[];
    notifications: AppNotification[];
    unreadNotificationCount: number;
    reminderSettings: ReminderSettings;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<AuthResponse>;
    signUp: (
        name: string,
        email: string,
        password: string,
    ) => Promise<AuthResponse>;
    signOut: () => void;

    saveMood: (mood: MoodEntry['mood'], note: string) => void;
    deleteEntry: (id: string) => void;
    clearEntries: () => void;

    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    clearNotifications: () => void;

    updateReminderSettings: (
        settings: Partial<ReminderSettings>,
    ) => void;
    getTodayMood: () => Promise<MoodEntry | null>;
    getRecentMoods: (days?: number) => Promise<MoodEntry[]>;
    getMonthMoods: (year: number, month: number) => Promise<MoodEntry[]>;
    getMoodById: (id: string) => Promise<MoodEntry>;
    getAllTimeStatistics: () => Promise<MoodStatisticsResponse>;
    getRecentStatistics: (days?: number) => Promise<MoodStatisticsResponse>;
    getMonthStatistics: (
        year: number,
        month: number,
    ) => Promise<MoodStatisticsResponse>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [entries, setEntries] = useState<MoodEntry[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
        DEFAULT_REMINDER_SETTINGS,
    );
    const [loading, setLoading] = useState(true);

    const persist = useCallback(
        (
            currentUser: User,
            currentEntries: MoodEntry[],
            currentNotifications: AppNotification[],
        ) => {
            const session: StoredSession = {
                user: currentUser,
                entries: currentEntries,
                notifications: currentNotifications,
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        },
        [],
    );

    const clearSession = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setEntries([]);
        setNotifications([]);
    }, []);

    const startSession = useCallback(
        (
            currentUser: User,
            currentEntries: MoodEntry[] = [],
            currentNotifications: AppNotification[] = [],
        ) => {
            setUser(currentUser);
            setEntries(currentEntries);
            setNotifications(currentNotifications);
            setReminderSettings(reminderSettingsFromUser(currentUser));

            persist(currentUser, currentEntries, currentNotifications);
        },
        [persist],
    );

    useEffect(() => {
        let mounted = true;

        async function initialize(): Promise<void> {
            try {
                const rawSettings = localStorage.getItem(SETTINGS_KEY);

                if (rawSettings) {
                    try {
                        const settings = JSON.parse(rawSettings) as ReminderSettings;

                        if (mounted) {
                            setReminderSettings(settings);
                        }
                    } catch {
                        localStorage.removeItem(SETTINGS_KEY);
                    }
                }

                const session = await api.apiGetSession();

                if (!mounted) {
                    return;
                }

                if (!session?.user) {
                    clearSession();
                    return;
                }

                startSession(
                    session.user,
                    mapSessionEntries(session.entries as MoodWireEntry[]),
                    mapSessionNotifications(session.notifications as NotificationWire[]),
                );
            } catch (error) {
                if (mounted) {
                    console.error('Session check failed:', error);
                    clearSession();
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        void initialize();

        return () => {
            mounted = false;
        };
    }, [clearSession, startSession]);

    const signIn = useCallback(
        async (email: string, password: string): Promise<AuthResponse> => {
            const response: any = await api.apiSignIn(email, password);

            if (!response?.user) {
                throw new Error('Invalid sign-in response');
            }

            startSession(
                response.user,
                mapSessionEntries(response.entries as MoodWireEntry[]),
                mapSessionNotifications(response.notifications as NotificationWire[]),
            );

            return response;
        },
        [startSession],
    );

    const signUp = useCallback(
        async (
            name: string,
            email: string,
            password: string,
        ): Promise<AuthResponse> => {
            const response: any = await api.apiSignUp(name, email, password);

            if (!response?.user) {
                throw new Error('Invalid sign-up response');
            }

            startSession(
                response.user,
                mapSessionEntries(response.entries as MoodWireEntry[]),
                mapSessionNotifications(response.notifications as NotificationWire[]),
            );

            return response;
        },
        [startSession],
    );

    const signOut = useCallback(() => {
        clearSession();

        void api.apiSignOut().catch((error) => {
            console.error('Backend sign-out failed:', error);
        });
    }, [clearSession]);

    const saveMood = useCallback(
        (mood: MoodEntry['mood'], note: string) => {
            if (!user) {
                return;
            }

            const today = todayISO();

            setEntries((previousEntries) => {
                const existingEntry = previousEntries.find(
                    (entry) => entry.date === today,
                );

                let nextEntries: MoodEntry[];

                if (existingEntry) {
                    nextEntries = previousEntries.map((entry) =>
                        entry.id === existingEntry.id
                            ? {
                                ...entry,
                                mood,
                                note,
                                createdAt: new Date().toISOString(),
                            }
                            : entry,
                    );
                } else {
                    nextEntries = [
                        ...previousEntries,
                        {
                            id: `entry-${Date.now()}`,
                            date: today,
                            mood,
                            note,
                            createdAt: new Date().toISOString(),
                        },
                    ];
                }

                persist(user, nextEntries, notifications);

                void api
                    .apiSaveMood({ mood, note: note || null })
                    .then((savedEntry) => {
                        const normalized = mapMoodEntry(savedEntry as MoodWireEntry);

                        setEntries((previousEntries) => {
                            const withoutToday = previousEntries.filter(
                                (entry) => entry.date !== normalized.date,
                            );
                            const nextEntries = [...withoutToday, normalized];
                            persist(user, nextEntries, notifications);
                            return nextEntries;
                        });
                    })
                    .catch((error) => {
                        console.error('Saving mood failed:', error);
                    });

                return nextEntries;
            });
        },
        [user, notifications, persist],
    );

    const getTodayMood = useCallback(async (): Promise<MoodEntry | null> => {
        const entry = await api.apiGetMood();
        return entry ? mapMoodEntry(entry as MoodWireEntry) : null;
    }, []);

    const getRecentMoods = useCallback(
        async (days = 7): Promise<MoodEntry[]> => {
            const entries = await api.apiGetLastWeekMood(days);
            return entries.map((entry) => mapMoodEntry(entry as MoodWireEntry));
        },
        [],
    );

    const getMonthMoods = useCallback(
        async (year: number, month: number): Promise<MoodEntry[]> => {
            const entries = await api.apiGetMonthMood(year, month);
            return entries.map((entry) => mapMoodEntry(entry as MoodWireEntry));
        },
        [],
    );

    const getMoodById = useCallback(
        async (id: string): Promise<MoodEntry> => {
            const entry = await api.apiGetMoodById(id);
            return mapMoodEntry(entry as MoodWireEntry);
        },
        [],
    );

    const getAllTimeStatistics = useCallback(async (): Promise<MoodStatisticsResponse> => {
        const stats = await api.apiStatisticsAllTimeMood();
        return mapMoodStatistics(stats as MoodWireStatistics);
    }, []);

    const getRecentStatistics = useCallback(
        async (days = 30): Promise<MoodStatisticsResponse> => {
            const stats = await api.apiStatisticsRecentMood(days);
            return mapMoodStatistics(stats as MoodWireStatistics);
        },
        [],
    );

    const getMonthStatistics = useCallback(
        async (year: number, month: number): Promise<MoodStatisticsResponse> => {
            const stats = await api.apiStatisticsMonthMood(year, month);
            return mapMoodStatistics(stats as MoodWireStatistics);
        },
        [],
    );

    const deleteEntry = useCallback(
        (id: string) => {
            if (!user) {
                return;
            }

            setEntries((previousEntries) => {
                const nextEntries = previousEntries.filter((entry) => entry.id !== id);

                persist(user, nextEntries, notifications);

                void api.apiDeleteEntry(id).catch((error) => {
                    console.error('Deleting mood entry failed:', error);
                });

                return nextEntries;
            });
        },
        [user, notifications, persist],
    );

    const clearEntries = useCallback(() => {
        if (!user) {
            return;
        }

        setEntries([]);
        persist(user, [], notifications);
    }, [user, notifications, persist]);

    const markNotificationRead = useCallback(
        (id: string) => {
            setNotifications((previousNotifications) => {
                const nextNotifications = previousNotifications.map((notification) =>
                    notification.id === id
                        ? { ...notification, read: true }
                        : notification,
                );

                if (user) {
                    persist(user, entries, nextNotifications);
                }

                void api.apiMarkNotificationRead(id).catch((error) => {
                    console.error('Marking notification as read failed:', error);
                });

                return nextNotifications;
            });
        },
        [user, entries, persist],
    );

    const markAllNotificationsRead = useCallback(() => {
        setNotifications((previousNotifications) => {
            const nextNotifications = previousNotifications.map((notification) => ({
                ...notification,
                read: true,
            }));

            if (user) {
                persist(user, entries, nextNotifications);
            }

            void api.apiMarkAllNotificationsRead().catch((error) => {
                console.error('Marking all notifications as read failed:', error);
            });

            return nextNotifications;
        });
    }, [user, entries, persist]);

    const clearNotifications = useCallback(() => {
        setNotifications([]);

        if (user) {
            persist(user, entries, []);
        }
    }, [user, entries, persist]);

    const updateReminderSettings = useCallback(
        (partialSettings: Partial<ReminderSettings>) => {
            setReminderSettings((previousSettings) => {
                const nextSettings = {
                    ...previousSettings,
                    ...partialSettings,
                };

                localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));

                void api.apiUpdateReminderSettings(nextSettings).catch((error) => {
                    console.error('Updating reminder settings failed:', error);
                });

                return nextSettings;
            });
        },
        [],
    );

    useEffect(() => {
        if (!user) return;

        let cancelled = false;
        const refresh = async () => {
            try {
                const serverNotifications = await api.apiGetNotifications();
                if (!cancelled) {
                    const next = mapSessionNotifications(serverNotifications);
                    setNotifications(next);
                    persist(user, entries, next);
                }
            } catch (error) {
                console.error('Refreshing notifications failed:', error);
            }
        };

        void refresh();
        const timer = window.setInterval(refresh, 60_000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [user, entries, persist]);

    const unreadNotificationCount = useMemo(
        () => unreadCount(notifications),
        [notifications],
    );

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            entries,
            notifications: sortNotifications(notifications),
            unreadNotificationCount,
            reminderSettings,
            loading,
            signIn,
            signUp,
            signOut,
            saveMood,
            deleteEntry,
            clearEntries,
            markNotificationRead,
            markAllNotificationsRead,
            clearNotifications,
            updateReminderSettings,
            getTodayMood,
            getRecentMoods,
            getMonthMoods,
            getMoodById,
            getAllTimeStatistics,
            getRecentStatistics,
            getMonthStatistics,
        }),
        [
            user,
            entries,
            notifications,
            unreadNotificationCount,
            reminderSettings,
            loading,
            signIn,
            signUp,
            signOut,
            saveMood,
            deleteEntry,
            clearEntries,
            markNotificationRead,
            markAllNotificationsRead,
            clearNotifications,
            updateReminderSettings,
            getTodayMood,
            getRecentMoods,
            getMonthMoods,
            getMoodById,
            getAllTimeStatistics,
            getRecentStatistics,
            getMonthStatistics,
        ],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }

    return context;
}
