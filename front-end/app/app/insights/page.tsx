'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Flame,
  Smile,
  CalendarRange,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { MOODS, getMood } from '@/lib/moods';
import { toISODate, formatDateMedium, addDays, computeStreak } from '@/lib/dates';
import type { MoodId } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Range = 7 | 30;

export default function InsightsPage() {
  const { entries } = useAuth();
  const [range, setRange] = useState<Range>(7);

  const entryByDate = useMemo(() => {
    const map = new Map<string, MoodId>();
    for (const e of entries) map.set(e.date, e.mood);
    return map;
  }, [entries]);

  const trendData = useMemo(() => {
    const today = new Date();
    const days = range;
    const arr: Array<{ date: string; label: string; score: number | null; mood: MoodId | null }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const iso = toISODate(d);
      const mood = entryByDate.get(iso) ?? null;
      arr.push({
        date: iso,
        label: formatDateMedium(iso),
        score: mood ? getMood(mood).score : null,
        mood,
      });
    }
    return arr;
  }, [entryByDate, range]);

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.mood] = (counts[e.mood] ?? 0) + 1;
    return MOODS.map((m) => ({
      label: m.label,
      count: counts[m.id] ?? 0,
      chart: m.chart,
      id: m.id,
    }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  const stats = useMemo(() => {
    const dateSet = new Set(entries.map((e) => e.date));
    const streak = computeStreak(dateSet);
    const total = entries.length;
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.mood] = (counts[e.mood] ?? 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const topMood = top ? getMood(top[0] as MoodId) : null;

    const scores = entries
      .map((e) => getMood(e.mood).score)
      .filter((s): s is number => typeof s === 'number');
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // best day = highest score, most recent if tie
    let bestEntry = entries[0];
    for (const e of entries) {
      if (!bestEntry || getMood(e.mood).score > getMood(bestEntry.mood).score) {
        bestEntry = e;
      }
    }

    return { streak, total, topMood, avg, bestEntry };
  }, [entries]);

  const avgLabel = useMemo(() => {
    const closest = MOODS.reduce((best, m) =>
      Math.abs(m.score - stats.avg) < Math.abs(best.score - stats.avg) ? m : best
    );
    return closest;
  }, [stats.avg]);

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-in-up">
        <InsightStat
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          value={`${stats.streak}`}
          label="Current streak"
        />
        <InsightStat
          icon={<CalendarRange className="h-5 w-5 text-teal-500" />}
          value={`${stats.total}`}
          label="Total entries"
        />
        <InsightStat
          icon={<Smile className="h-5 w-5 text-amber-500" />}
          value={stats.topMood?.emoji ?? '—'}
          label="Top mood"
        />
        <InsightStat
          icon={<Award className="h-5 w-5 text-violet-500" />}
          value={avgLabel.emoji}
          label="Average mood"
        />
      </div>

      {/* Trend chart */}
      <Card className="p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5 text-primary" /> Mood trend
            </h3>
            <p className="text-sm text-muted-foreground">Your emotional trajectory over time</p>
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1">
            {([7, 30] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  range === r
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval={range === 30 ? 5 : 0}
              />
              <YAxis
                domain={[1, 7]}
                ticks={[1, 2, 3, 4, 5, 6, 7]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const m = MOODS.find((x) => x.score === v);
                  return m ? m.emoji : '';
                }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#14b8a6"
                strokeWidth={2.5}
                fill="url(#moodGradient)"
                connectNulls
                dot={{ r: 3, fill: '#14b8a6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Distribution */}
      <div className="grid gap-6 lg:grid-cols-5 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <h3 className="mb-4 text-lg font-semibold">Mood distribution</h3>
          {distribution.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                    {distribution.map((d) => (
                      <Cell key={d.id} fill={d.chart} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Highlights */}
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">Highlights</h3>
          <div className="space-y-3">
            <Highlight
              label="Best day"
              value={stats.bestEntry ? getMood(stats.bestEntry.mood).label : '—'}
              sub={stats.bestEntry ? formatDateMedium(stats.bestEntry.date) : ''}
              emoji={stats.bestEntry ? getMood(stats.bestEntry.mood).emoji : ''}
            />
            <Highlight
              label="Longest streak"
              value={`${stats.streak} days`}
              emoji="🔥"
            />
            <Highlight
              label="Most frequent"
              value={stats.topMood?.label ?? '—'}
              emoji={stats.topMood?.emoji ?? ''}
            />
            <Highlight
              label="Average mood"
              value={avgLabel.label}
              sub={stats.avg ? `${stats.avg.toFixed(1)} / 7` : ''}
              emoji={avgLabel.emoji}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function InsightStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function Highlight({
  label,
  value,
  sub,
  emoji,
}: {
  label: string;
  value: string;
  sub?: string;
  emoji: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
      <span className="text-2xl">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const mood = point.mood ? getMood(point.mood) : null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{point.label}</p>
      {mood ? (
        <p className="mt-0.5 flex items-center gap-1.5">
          <span>{mood.emoji}</span>
          <span className={mood.color}>{mood.label}</span>
        </p>
      ) : (
        <p className="mt-0.5 text-muted-foreground">No entry</p>
      )}
    </div>
  );
}
