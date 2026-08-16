'use client';

import { useMemo } from 'react';
import {
  Mail,
  CalendarDays,
  Flame,
  CalendarCheck,
  Smile,
  Sun,
  Moon,
  Trash2,
  LogOut,
  Settings as SettingsIcon,
  Bell,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { getMood, MOODS } from '@/lib/moods';
import { formatDateLong } from '@/lib/dates';
import type { MoodId } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

function computeStreak(dateSet: Set<string>): number {
  const today = new Date();
  let streak = 0;

  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split('T')[0];

    if (!dateSet.has(iso)) break;
    streak += 1;
  }

  return streak;
}

export default function ProfilePage() {
  const {
    user,
    entries,
    signOut,
    clearEntries,
    reminderSettings,
    updateReminderSettings,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const initials = (user?.full_name ?? '?')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const stats = useMemo(() => {
    const dateSet = new Set(entries.map((e) => e.date));
    const streak = computeStreak(dateSet);
    const total = entries.length;
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.mood] = (counts[e.mood] ?? 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const topMood = top ? getMood(top[0] as MoodId) : null;
    return { streak, total, topMood };
  }, [entries]);

  const joinedDate = user ? formatDateLong(user.joined_at.split('T')[0]) : '';

  return (
      <div className="space-y-6">
        {/* Profile header */}
        <Card className="overflow-hidden animate-fade-in-up">
          <div className="h-24 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-600" />
          <div className="px-5 pb-5 sm:px-6">
            <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <Avatar className="h-20 w-20 border-4 border-card shadow-lg">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-xl font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 pb-1">
                  <h2 className="truncate text-xl font-bold">
                    {user?.full_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Member since {joinedDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniStat
                  icon={<Flame className="h-4 w-4 text-orange-500" />}
                  value={`${stats.streak}`}
                  label="Day streak"
              />
              <MiniStat
                  icon={<CalendarCheck className="h-4 w-4 text-teal-500" />}
                  value={`${stats.total}`}
                  label="Entries"
              />
              <MiniStat
                  icon={<Smile className="h-4 w-4 text-amber-500" />}
                  value={stats.topMood?.emoji ?? '—'}
                  label="Top mood"
              />
            </div>
          </div>
        </Card>

        {/* Account info */}
        <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <h3 className="mb-4 text-lg font-semibold">Account</h3>
          <div className="space-y-4">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={user?.email ?? ''} />
            <Separator />
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Joined" value={joinedDate} />
          </div>
        </Card>

        {/* Settings */}
        <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <div className="mb-4 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Settings</h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between rounded-xl p-3 hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Dark mode</p>
                  <p className="text-xs text-muted-foreground">
                    Switch between light and dark themes
                  </p>
                </div>
              </div>
              <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-xl p-3 hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Daily mood reminders</p>
                  <p className="text-xs text-muted-foreground">
                    Get a notification each day to log your mood
                  </p>
                </div>
              </div>
              <Switch
                  checked={reminderSettings.enabled}
                  onCheckedChange={(checked) => {
                    updateReminderSettings({ enabled: checked });
                    toast.success(checked ? 'Daily reminders on' : 'Daily reminders off');
                  }}
              />
            </div>

            {reminderSettings.enabled && (
                <div className="flex items-center justify-between rounded-xl p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Reminder time</p>
                      <p className="text-xs text-muted-foreground">
                        When the daily reminder appears
                      </p>
                    </div>
                  </div>
                  <Select
                      value={String(reminderSettings.hour)}
                      onValueChange={(val) => updateReminderSettings({ hour: Number(val) })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
            )}
          </div>
        </Card>

        {/* Mood preferences preview */}
        <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <h3 className="mb-4 text-lg font-semibold">Your mood scale</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MOODS.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{m.score}/7</span>
                </div>
            ))}
          </div>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30 p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <h3 className="mb-1 text-lg font-semibold text-destructive">Danger zone</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            These actions are permanent and cannot be undone.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" /> Clear all entries
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all your mood entries?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {stats.total} entries from your account. You will start fresh.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        clearEntries();
                        toast.success('All entries cleared');
                      }}
                  >
                    Clear everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out of BoltMood?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will need to sign back in to continue tracking your mood.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Stay signed in</AlertDialogCancel>
                  <AlertDialogAction onClick={signOut}>Sign out</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      </div>
  );
}

function InfoRow({
                   icon,
                   label,
                   value,
                 }: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{value}</p>
        </div>
      </div>
  );
}

function MiniStat({
                    icon,
                    value,
                    label,
                  }: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
      <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3 text-center">
        {icon}
        <span className="text-lg font-bold">{value}</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
  );
}
