'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flame, Medal, RefreshCw, Trophy } from 'lucide-react';
import { apiGetLeaderboard } from '@/lib/api';
import type { LeaderboardEntry, LeaderboardResponse } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  if (rank === 2) return 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300';
  if (rank === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300';
  return 'bg-muted text-muted-foreground';
}

function EntryRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-3 transition-colors',
      entry.is_current_user ? 'border-primary/40 bg-primary/5' : 'border-transparent bg-muted/30')}>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', rankStyle(entry.rank))}>
        {entry.rank <= 3 ? <Medal className="h-4 w-4" /> : entry.rank}
      </div>
      <Avatar className="h-10 w-10 border">
        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-xs font-semibold text-white">
          {initials(entry.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {entry.full_name} {entry.is_current_user && <span className="font-normal text-primary">(you)</span>}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> {entry.streak_days} day streak
        </p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold tabular-nums">{entry.score}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">points</p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await apiGetLeaderboard()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load leaderboard'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 p-6 text-white shadow-lg shadow-teal-500/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/80"><Trophy className="h-4 w-4" /> Streak leaderboard</p>
            <h2 className="text-2xl font-bold">Small steps, big momentum.</h2>
            <p className="mt-2 max-w-xl text-sm text-white/80">Every consecutive mood check-in earns a point. Keep showing up and climb the ranks.</p>
          </div>
          <Button variant="secondary" size="icon" onClick={load} disabled={loading} aria-label="Refresh leaderboard"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></Button>
        </div>
        {data && <div className="mt-6 flex items-end gap-8">
          <div><p className="text-3xl font-bold">{data.current_user.rank}</p><p className="text-xs text-white/70">Your rank</p></div>
          <div><p className="text-3xl font-bold">{data.current_user.score}</p><p className="text-xs text-white/70">Your points</p></div>
          <div><p className="text-3xl font-bold">{data.total_users}</p><p className="text-xs text-white/70">Members</p></div>
        </div>}
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-semibold">Top streaks</h3><p className="text-sm text-muted-foreground">Live scores from the latest check-ins</p></div><Trophy className="h-5 w-5 text-amber-500" /></div>
        {loading ? <div className="space-y-3">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
          : error ? <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          : data?.items.length ? <div className="space-y-3">{data.items.map((entry) => <EntryRow key={entry.user_id} entry={entry} />)}</div>
          : <p className="py-10 text-center text-sm text-muted-foreground">Log your first mood to enter the leaderboard.</p>}
      </Card>
    </div>
  );
}
