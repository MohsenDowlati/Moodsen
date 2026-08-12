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
import type { AppNotification, MoodEntry, ReminderSettings, User } from './types';
import {
  DEMO_USER,
  generateSeedEntries,
} from './mock-data';
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

const STORAGE_KEY = 'boltmood.session.v1';
const SETTINGS_KEY = 'boltmood.reminder.v1';

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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => void;
  saveMood: (mood: MoodEntry['mood'], note: string) => void;
  deleteEntry: (id: string) => void;
  clearEntries: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  updateReminderSettings: (settings: Partial<ReminderSettings>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function newUser(name: string, email: string): User {
  return {
    id: `user-${Date.now()}`,
    name,
    email,
    joinedAt: new Date().toISOString(),
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
    DEFAULT_REMINDER_SETTINGS,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw) as StoredSession;
        setUser(session.user);
        setEntries(session.entries ?? []);
        setNotifications(session.notifications ?? []);
      }
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        setReminderSettings(JSON.parse(rawSettings) as ReminderSettings);
      }
    } catch {
      // ignore corrupt storage
    }
    setLoading(false);
  }, []);

  const persist = useCallback(
    (u: User, e: MoodEntry[], notifs: AppNotification[]) => {
      const session: StoredSession = { user: u, entries: e, notifications: notifs };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    },
    [],
  );

  const startSession = useCallback(
    (u: User, seed: MoodEntry[]) => {
      setUser(u);
      setEntries(seed);
      setNotifications([]);
      persist(u, seed, []);
    },
    [persist],
  );

  const signIn = useCallback(
    async (email: string, _password: string) => {
      await delay(700);
      const name = email.split('@')[0].replace(/[._-]/g, ' ');
      const pretty = name
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      startSession(
        { ...newUser(pretty || 'Friend', email), id: `user-${email}` },
        generateSeedEntries(),
      );
    },
    [startSession],
  );

  const signUp = useCallback(
    async (name: string, email: string, _password: string) => {
      await delay(800);
      startSession(newUser(name, email), generateSeedEntries());
    },
    [startSession],
  );

  const signInDemo = useCallback(async () => {
    await delay(450);
    startSession(DEMO_USER, generateSeedEntries());
  }, [startSession]);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setEntries([]);
    setNotifications([]);
  }, []);

  const saveMood = useCallback(
    (mood: MoodEntry['mood'], note: string) => {
      if (!user) return;
      const today = todayISO();
      setEntries((prev) => {
        const existing = prev.find((e) => e.date === today);
        let next: MoodEntry[];
        if (existing) {
          next = prev.map((e) =>
            e.id === existing.id
              ? { ...e, mood, note, createdAt: new Date().toISOString() }
              : e,
          );
        } else {
          next = [
            ...prev,
            {
              id: `entry-${Date.now()}`,
              date: today,
              mood,
              note,
              createdAt: new Date().toISOString(),
            },
          ];
        }
        persist(user, next, notifications);
        return next;
      });
    },
    [user, persist],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      if (!user) return;
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persist(user, next, notifications);
        return next;
      });
    },
    [user, persist],
  );

  const clearEntries = useCallback(() => {
    if (!user) return;
    setEntries([]);
    persist(user, [], notifications);
  }, [user, persist, notifications]);

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        if (user) persist(user, entries, next);
        return next;
      });
    },
    [user, entries, persist],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      if (user) persist(user, entries, next);
      return next;
    });
  }, [user, entries, persist]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    if (user) persist(user, entries, []);
  }, [user, entries, persist]);

  const updateReminderSettings = useCallback(
    (partial: Partial<ReminderSettings>) => {
      setReminderSettings((prev) => {
        const next = { ...prev, ...partial };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  // Daily reminder + streak check — runs when user is loaded and on each
  // entries change, generates at most one reminder and one streak
  // notification per day.
  useEffect(() => {
    if (!user) return;

    const newNotifs: AppNotification[] = [];

    if (shouldGenerateDailyReminder(reminderSettings, notifications)) {
      newNotifs.push(makeReminderNotification(undefined, user.name));
    }

    if (shouldGenerateStreakNotification(entries, notifications)) {
      const dates = new Set(entries.map((e) => e.date));
      let streak = 0;
      const cursor = new Date();
      if (!dates.has(toISODate(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (dates.has(toISODate(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      newNotifs.push(makeStreakNotification(streak));
    }

    if (newNotifs.length === 0) return;

    setNotifications((prev) => {
      const next = sortNotifications([...newNotifs, ...prev]);
      persist(user, entries, next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, entries]);

  const unread = useMemo(() => unreadCount(notifications), [notifications]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      entries,
      notifications: sortNotifications(notifications),
      unreadNotificationCount: unread,
      reminderSettings,
      loading,
      signIn,
      signUp,
      signInDemo,
      signOut,
      saveMood,
      deleteEntry,
      clearEntries,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      updateReminderSettings,
    }),
    [user, entries, notifications, unread, reminderSettings, loading, signIn, signUp, signInDemo, signOut, saveMood, deleteEntry, clearEntries, markNotificationRead, markAllNotificationsRead, clearNotifications, updateReminderSettings],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
