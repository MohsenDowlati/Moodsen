'use client';

import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Inbox,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getMood } from '@/lib/moods';
import {
  fromISODate,
  monthName,
  formatDateLong,
  todayISO,
} from '@/lib/dates';
import type { MoodEntry } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
import { MOODS } from '@/lib/moods';

export default function HistoryPage() {
  const { entries, deleteEntry } = useAuth();
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const entryByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    for (const e of entries) map.set(e.date, e);
    return map;
  }, [entries]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  // Build calendar grid for monthCursor
  const calendarDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null; iso: string | null }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      cells.push({
        date,
        iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
    return cells;
  }, [monthCursor]);

  const monthLabel = `${monthName(monthCursor.getMonth())} ${monthCursor.getFullYear()}`;
  const today = todayISO();
  const canGoForward = (() => {
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthCursor < current;
  })();

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <Card className="p-5 sm:p-6 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canGoForward}
              onClick={() =>
                setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
            <div key={w} className="text-center text-[11px] font-medium text-muted-foreground">
              {w}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((cell, i) => {
            if (!cell.date) {
              return <div key={i} className="aspect-square" />;
            }
            const entry = entryByDate.get(cell.iso!);
            const isToday = cell.iso === today;
            const mood = entry ? getMood(entry.mood) : null;
            return (
              <div
                key={i}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs transition-all',
                  isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  mood ? cn(mood.bg, 'border-transparent') : 'border-border/60 bg-muted/30',
                )}
                title={mood ? `${mood.label}${entry?.note ? ' — ' + entry.note : ''}` : 'No entry'}
              >
                <span className={cn('text-sm', mood && 'font-semibold')}>
                  {cell.date.getDate()}
                </span>
                {mood && <span className="text-base leading-none">{mood.emoji}</span>}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
          {MOODS.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', m.bg)} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Timeline */}
      <div className="animate-fade-in-up" style={{ animationDelay: '80ms' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent entries</h3>
          <span className="text-sm text-muted-foreground">{entries.length} total</span>
        </div>

        {sortedEntries.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No entries yet</p>
              <p className="text-sm text-muted-foreground">Your logged moods will appear here.</p>
            </div>
          </Card>
        ) : (
          <div className="relative space-y-3">
            {/* timeline line */}
            <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border" />
            {sortedEntries.slice(0, 40).map((entry) => (
              <TimelineItem
                key={entry.id}
                entry={entry}
                onDelete={deleteEntry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineItem({
  entry,
  onDelete,
}: {
  entry: MoodEntry;
  onDelete: (id: string) => void;
}) {
  const mood = getMood(entry.mood);
  const d = fromISODate(entry.date);
  const time = new Date(entry.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="relative flex gap-4">
      {/* node */}
      <div
        className={cn(
          'z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ring-4 ring-background',
          mood.bg,
        )}
      >
        {mood.emoji}
      </div>

      <Card className="flex-1 p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-semibold', mood.color)}>{mood.label}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatDateLong(entry.date)}</p>
            {entry.note && (
              <p className="mt-2 text-sm leading-relaxed">{entry.note}</p>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="shrink-0 rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove your {mood.label.toLowerCase()} entry from {formatDateLong(entry.date)}. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    onDelete(entry.id);
                    toast.success('Entry deleted');
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}
