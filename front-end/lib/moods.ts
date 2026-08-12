import type { Mood, MoodId } from './types';

export const MOODS: Mood[] = [
  {
    id: 'joyful',
    label: 'Joyful',
    emoji: '😄',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    gradient: 'from-amber-400 to-yellow-500',
    chart: '#f59e0b',
    score: 7,
    description: 'Bright, happy, and full of energy',
  },
  {
    id: 'calm',
    label: 'Calm',
    emoji: '😌',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-500/15',
    gradient: 'from-teal-400 to-emerald-500',
    chart: '#14b8a6',
    score: 6,
    description: 'Peaceful, relaxed, and centered',
  },
  {
    id: 'motivated',
    label: 'Motivated',
    emoji: '💪',
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-100 dark:bg-sky-500/15',
    gradient: 'from-sky-400 to-blue-500',
    chart: '#0ea5e9',
    score: 5,
    description: 'Driven, focused, and ready to go',
  },
  {
    id: 'neutral',
    label: 'Neutral',
    emoji: '😐',
    color: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-500/15',
    gradient: 'from-slate-400 to-slate-500',
    chart: '#94a3b8',
    score: 4,
    description: 'Steady, nothing notable either way',
  },
  {
    id: 'anxious',
    label: 'Anxious',
    emoji: '😟',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    gradient: 'from-violet-400 to-purple-500',
    chart: '#8b5cf6',
    score: 3,
    description: 'On edge, worried, or restless',
  },
  {
    id: 'sad',
    label: 'Sad',
    emoji: '😢',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-500/15',
    gradient: 'from-indigo-400 to-blue-600',
    chart: '#6366f1',
    score: 2,
    description: 'Down, low, or heavy-hearted',
  },
  {
    id: 'angry',
    label: 'Angry',
    emoji: '😠',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    gradient: 'from-rose-400 to-red-500',
    chart: '#f43f5e',
    score: 1,
    description: 'Frustrated, heated, or irritated',
  },
];

export const MOOD_MAP: Record<MoodId, Mood> = MOODS.reduce(
  (acc, m) => ({ ...acc, [m.id]: m }),
  {} as Record<MoodId, Mood>,
);

export function getMood(id: MoodId): Mood {
  return MOOD_MAP[id];
}
