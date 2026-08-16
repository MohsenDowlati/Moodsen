'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { toISODate, formatDateMedium, addDays } from '@/lib/dates';
import type { MoodId, MoodEntry, MoodStatisticsResponse } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Range = 7 | 30;

type TrendPoint = {
  date: string;
  label: string;
  score: number | null;
  mood: MoodId | null;
};

type DistributionItem = {
  label: string;
  count: number;
  chart: string;
  id: MoodId;
};

function buildTrendData(entries: MoodEntry[], range: Range): TrendPoint[] {
  const byDate = new Map<string, MoodId>();
  for (const entry of entries) byDate.set(entry.date, entry.mood);

  const today = new Date();
  const arr: TrendPoint[] = [];

  for (let i = range - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const iso = toISODate(d);
    const mood = byDate.get(iso) ?? null;

    arr.push({
      date: iso,
      label: formatDateMedium(iso),
      score: mood ? getMood(mood).score : null,
      mood,
    });
  }

  return arr;
}

function buildDistribution(
    stats: MoodStatisticsResponse | null,
): DistributionItem[] {
  if (!stats) return [];

  return MOODS.map((m) => ({
    label: m.label,
    count: stats.mood_distribution[m.id] ?? 0,
    chart: m.chart,
    id: m.id,
  }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
}

function averageMoodLabel(avg: number): (typeof MOODS)[number] {
  return MOODS.reduce((best, m) =>
      Math.abs(m.score - avg) < Math.abs(best.score - avg) ? m : best,
  );
}

export default function InsightsPage() {
  const { getAllTimeStatistics, getRecentMoods } = useAuth();

  const [range, setRange] = useState<Range>(7);
  const [statistics, setStatistics] = useState<MoodStatisticsResponse | null>(
      null,
  );
  const [trendEntries, setTrendEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      try {
        const [stats, recent] = await Promise.all([
          getAllTimeStatistics(),
          getRecentMoods(range),
        ]);

        if (cancelled) return;

        setStatistics(stats);
        setTrendEntries(recent);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [getAllTimeStatistics, getRecentMoods, range]);

  const trendData = useMemo(
      () => buildTrendData(trendEntries, range),
      [trendEntries, range],
  );

  const distribution = useMemo(
      () => buildDistribution(statistics),
      [statistics],
  );

  const avgLabel = useMemo(() => {
    if (!statistics) return MOODS[0];
    return averageMoodLabel(statistics.average_mood_score ?? 0);
  }, [statistics]);

  const bestMood = statistics?.most_common_mood
      ? getMood(statistics.most_common_mood)
      : null;

  const bestWeekday = statistics?.best_weekday ?? null;

  return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-in-up">
          <InsightStat
              icon={<Flame className="h-5 w-5 text-orange-500" />}
              value={loading ? '—' : `${statistics?.current_streak ?? 0}`}
              label="Current streak"
          />
          <InsightStat
              icon={<CalendarRange className="h-5 w-5 text-teal-500" />}
              value={loading ? '—' : `${statistics?.total_entries ?? 0}`}
              label="Total entries"
          />
          <InsightStat
              icon={<Smile className="h-5 w-5 text-amber-500" />}
              value={loading ? '—' : bestMood?.emoji ?? '—'}
              label="Top mood"
          />
          <InsightStat
              icon={<Award className="h-5 w-5 text-violet-500" />}
              value={loading ? '—' : avgLabel.emoji}
              label="Average mood"
          />
        </div>

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

          <Card className="p-5 sm:p-6 lg:col-span-2">
            <h3 className="mb-4 text-lg font-semibold">Highlights</h3>
            <div className="space-y-3">
              <Highlight
                  label="Best day"
                  value={bestMood ? bestMood.label : '—'}
                  sub={bestWeekday ?? ''}
                  emoji={bestMood ? bestMood.emoji : ''}
              />
              <Highlight
                  label="Longest streak"
                  value={`${statistics?.longest_streak ?? 0} days`}
                  emoji="🔥"
              />
              <Highlight
                  label="Most frequent"
                  value={bestMood?.label ?? '—'}
                  emoji={bestMood?.emoji ?? ''}
              />
              <Highlight
                  label="Average mood"
                  value={avgLabel.label}
                  sub={
                    statistics?.average_mood_score !== null &&
                    statistics?.average_mood_score !== undefined
                        ? `${statistics.average_mood_score.toFixed(1)} / 7`
                        : ''
                  }
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

function TrendTooltip({
                        active,
                        payload,
                      }: {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
}) {
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
