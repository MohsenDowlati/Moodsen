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
  ReminderSettings,
  User,
} from './types';
import { todayISO, toISODate } from './dates';

import {
  DEFAULT_REMINDER_SETTINGS,
  makeReminderNotification,
  makeStreakNotification,
  shouldGenerateDailyReminder,
  shouldGenerateStreakNotification,
  sortNotifications,
  unreadCount,
} from './notifications';

import * as api from './api';

type AuthResponse = Awaited<ReturnType<typeof api.apiSignIn>>;


const STORAGE_KEY = 'moodsen.session.v1';
const SETTINGS_KEY = 'moodsen.reminder.v1';

interface StoredSession {
  user: User;
  entries: MoodEntry[];
  notifications: AppNotification[];
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
                               children,
                             }: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reminderSettings, setReminderSettings] =
      useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
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

        persist(
            currentUser,
            currentEntries,
            currentNotifications,
        );
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
            const settings = JSON.parse(
                rawSettings,
            ) as ReminderSettings;

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
            session.entries ?? [],
            session.notifications ?? [],
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
                response.entries ?? [],
                response.notifications ?? [],
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
                response.entries ?? [],
                response.notifications ?? [],
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
              .apiSaveMood({
                date: today,
                mood,
                note,
              })
              .catch((error) => {
                console.error('Saving mood failed:', error);
              });

          return nextEntries;
        });
      },
      [user, notifications, persist],
  );

  const deleteEntry = useCallback(
      (id: string) => {
        if (!user) {
          return;
        }

        setEntries((previousEntries) => {
          const nextEntries = previousEntries.filter(
              (entry) => entry.id !== id,
          );

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
          const nextNotifications = previousNotifications.map(
              (notification) =>
                  notification.id === id
                      ? { ...notification, read: true }
                      : notification,
          );

          if (user) {
            persist(user, entries, nextNotifications);
          }

          void api
              .apiMarkNotificationRead(id)
              .catch((error) => {
                console.error(
                    'Marking notification as read failed:',
                    error,
                );
              });

          return nextNotifications;
        });
      },
      [user, entries, persist],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((previousNotifications) => {
      const nextNotifications = previousNotifications.map(
          (notification) => ({
            ...notification,
            read: true,
          }),
      );

      if (user) {
        persist(user, entries, nextNotifications);
      }

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

          localStorage.setItem(
              SETTINGS_KEY,
              JSON.stringify(nextSettings),
          );

          void api
              .apiUpdateReminderSettings(nextSettings)
              .catch((error) => {
                console.error(
                    'Updating reminder settings failed:',
                    error,
                );
              });

          return nextSettings;
        });
      },
      [],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    const newNotifications: AppNotification[] = [];

    if (
        shouldGenerateDailyReminder(
            reminderSettings,
            notifications,
        )
    ) {
      newNotifications.push(
          makeReminderNotification(undefined, user.full_name),
      );
    }

    if (
        shouldGenerateStreakNotification(
            entries,
            notifications,
        )
    ) {
      const dates = new Set(
          entries.map((entry) => entry.date),
      );

      let streak = 0;
      const cursor = new Date();

      if (!dates.has(toISODate(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }

      while (dates.has(toISODate(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }

      newNotifications.push(
          makeStreakNotification(streak),
      );
    }

    if (newNotifications.length === 0) {
      return;
    }

    setNotifications((previousNotifications) => {
      const nextNotifications = sortNotifications([
        ...newNotifications,
        ...previousNotifications,
      ]);

      persist(user, entries, nextNotifications);

      return nextNotifications;
    });

    // توابع بررسی notification مانع ساخت اعلان تکراری می‌شوند.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, entries]);

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
      ],
  );

  return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
        'useAuth must be used within AuthProvider',
    );
  }

  return context;
}
