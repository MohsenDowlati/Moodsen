'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Flame,
  CalendarCheck,
  Repeat,
  Check,
  Sparkles,
  PenLine,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { MOODS, getMood } from '@/lib/moods';
import { todayISO, formatDateLong, greetingFor, computeStreak } from '@/lib/dates';
import type { MoodId } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function TodayPage() {
  const { user, entries, saveMood } = useAuth();
  const today = todayISO();

  const todayEntry = useMemo(
    () => entries.find((e) => e.date === today),
    [entries, today],
  );

  const [selected, setSelected] = useState<MoodId | null>(
    todayEntry?.mood ?? null,
  );
  const [note, setNote] = useState(todayEntry?.note ?? '');
  const [saving, setSaving] = useState(false);

  const dateSet = useMemo(
    () => new Set(entries.map((e) => e.date)),
    [entries],
  );
  const streak = useMemo(() => computeStreak(dateSet), [dateSet]);
  const monthCount = useMemo(() => {
    const now = new Date();
    return entries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [entries]);

  const frequentMood = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.mood] = (counts[e.mood] ?? 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? getMood(top[0] as MoodId) : null;
  }, [entries]);

  const handleSave = async () => {
    if (!selected) {
      toast.error('Pick a mood first');
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    saveMood(selected, note.trim());
    setSaving(false);
    toast.success(todayEntry ? 'Mood updated for today' : 'Mood saved for today', {
      description: getMood(selected).label,
    });
  };

  const selectedMood = selected ? getMood(selected) : null;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="animate-fade-in-up">
        <p className="text-sm font-medium text-muted-foreground">
          {greetingFor()}, {user?.full_name.split(' ')[0]}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          How are you feeling today?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{formatDateLong(today)}</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <StatCard icon={<Flame className="h-4 w-4 text-orange-500" />} value={streak} label="Day streak" />
        <StatCard icon={<CalendarCheck className="h-4 w-4 text-teal-500" />} value={monthCount} label="This month" />
        <StatCard
          icon={<Repeat className="h-4 w-4 text-violet-500" />}
          value={frequentMood?.emoji ?? '—'}
          label="Most common"
        />
      </div>

      {/* Mood picker */}
      <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Pick your mood</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {MOODS.map((m) => {
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-200',
                  isSelected
                    ? 'border-transparent text-white shadow-lg'
                    : 'border-border bg-card hover:-translate-y-1 hover:shadow-md',
                )}
              >
                {isSelected && (
                  <span
                    className={cn(
                      'absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br',
                      m.gradient,
                    )}
                  />
                )}
                <span
                  className={cn(
                    'text-3xl transition-transform group-hover:scale-110',
                    isSelected && 'scale-110',
                  )}
                >
                  {m.emoji}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isSelected ? 'text-white' : 'text-foreground',
                  )}
                >
                  {m.label}
                </span>
                {isSelected && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary shadow">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedMood && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-sm text-muted-foreground"
          >
            <span className="font-medium text-foreground">{selectedMood.label}</span> — {selectedMood.description}
          </motion.p>
        )}
      </Card>

      {/* Note */}
      <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
        <div className="mb-3 flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Add a note (optional)</h3>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened today? What is on your mind?"
          className="min-h-[100px] resize-none"
          maxLength={500}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{note.length}/500</span>
          {todayEntry && (
            <span className="text-xs text-muted-foreground">
              Last updated {new Date(todayEntry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </Card>

      {/* Save */}
      <div className="flex flex-col gap-3 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: '240ms' }}>
        <p className="text-sm text-muted-foreground">
          {todayEntry
            ? 'You already logged today — saving again will update it.'
            : 'You have not logged today yet.'}
        </p>
        <Button
          onClick={handleSave}
          disabled={!selected || saving}
          className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20 hover:brightness-105 sm:px-8"
          size="lg"
        >
          {saving ? (
            <span className="animate-pulse">Saving…</span>
          ) : todayEntry ? (
            <>
              <Check className="mr-2 h-4 w-4" /> Update mood
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" /> Save today&apos;s mood
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-1 p-3 text-center sm:p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xl font-bold tabular-nums sm:text-2xl">{value}</span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</span>
    </Card>
  );
}
