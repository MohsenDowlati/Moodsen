'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ListFilter,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getMood } from '@/lib/moods';
import { monthName, formatDateShort } from '@/lib/dates';
import type { MoodEntry, MoodId } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function HistoryPage() {
  const { getMonthMoods } = useAuth();

  const [monthMoods, setMonthMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  useEffect(() => {
    let alive = true;

    async function fetchMonthData() {
      setLoading(true);
      try {
        const data = await getMonthMoods(monthCursor.year, monthCursor.month);
        if (alive) {
          setMonthMoods(data);
        }
      } catch (error) {
        console.error('Failed to fetch month moods:', error);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void fetchMonthData();

    return () => {
      alive = false;
    };
  }, [getMonthMoods, monthCursor]);

  const entryByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    for (const e of monthMoods) {
      map.set(e.date, e);
    }
    return map;
  }, [monthMoods]);

  const sortedEntries = useMemo(
      () => [...monthMoods].sort((a, b) => b.date.localeCompare(a.date)),
      [monthMoods],
  );

  const calendarDays = useMemo(() => {
    const { month, year } = monthCursor;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    return days;
  }, [monthCursor]);

  const monthLabel = `${monthName(monthCursor.month - 1)} ${monthCursor.year}`;

  const canGoForward = () => {
    const now = new Date();
    const current = new Date(monthCursor.year, monthCursor.month - 1);
    const today = new Date(now.getFullYear(), now.getMonth());
    return current < today;
  };

  const nextMonth = () => {
    setMonthCursor((prev) => {
      const next = new Date(prev.year, prev.month, 1);
      return { month: next.getMonth() + 1, year: next.getFullYear() };
    });
  };

  const prevMonth = () => {
    setMonthCursor((prev) => {
      const next = new Date(prev.year, prev.month - 2, 1);
      return { month: next.getMonth() + 1, year: next.getFullYear() };
    });
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            History & Calendar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse your past logs and see patterns across time.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Calendar Card */}
          <Card className="p-5 lg:col-span-7 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{monthLabel}</h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={prevMonth}
                    className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextMonth}
                    disabled={!canGoForward()}
                    className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }

                const dateStr = `${monthCursor.year}-${String(
                    monthCursor.month,
                ).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const entry = entryByDate.get(dateStr);
                const mood = entry ? getMood(entry.mood as MoodId) : null;

                return (
                    <div
                        key={dateStr}
                        className={cn(
                            'relative flex aspect-square flex-col items-center justify-between rounded-xl border p-1 text-xs transition-all',
                            entry
                                ? 'border-transparent text-white shadow-sm'
                                : 'border-border/60 bg-muted/20 text-muted-foreground',
                        )}
                    >
                      {entry && mood && (
                          <span
                              className={cn(
                                  'absolute inset-0 -z-10 rounded-xl bg-gradient-to-br',
                                  mood.gradient,
                              )}
                          />
                      )}
                      <span className="self-start text-[10px] font-medium leading-none">
                    {day}
                  </span>
                      {mood ? (
                          <span className="text-base sm:text-lg">{mood.emoji}</span>
                      ) : (
                          <span className="h-4" />
                      )}
                      <span className="h-1" />
                    </div>
                );
              })}
            </div>

            {loading && (
                <p className="mt-3 text-center text-xs text-muted-foreground animate-pulse">
                  Loading month data…
                </p>
            )}
          </Card>

          {/* Timeline */}
          <div className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Entries</h3>
              </div>
              <Badge variant="secondary" className="text-xs">
                {monthMoods.length} this month
              </Badge>
            </div>

            {sortedEntries.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm font-medium">No logs for this month</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Track your mood on the Today page to build your history.
                  </p>
                </Card>
            ) : (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {sortedEntries.map((entry) => {
                      const mood = getMood(entry.mood as MoodId);
                      return (
                          <motion.div
                              key={entry.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                          >
                            <Card className="relative overflow-hidden p-4">
                              <div className="flex items-start gap-3">
                          <span
                              className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm',
                                  mood.gradient,
                                  'bg-gradient-to-br text-white',
                              )}
                          >
                            {mood.emoji}
                          </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">
                                {mood.label}
                              </span>
                                    <span className="text-[11px] text-muted-foreground">
                                {formatDateShort(entry.date)}
                              </span>
                                  </div>
                                  {entry.note ? (
                                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                                        {entry.note}
                                      </p>
                                  ) : (
                                      <p className="mt-1 text-[11px] italic text-muted-foreground/60">
                                        No note written
                                      </p>
                                  )}
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}
