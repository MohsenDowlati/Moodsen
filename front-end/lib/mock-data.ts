import type { MoodEntry, MoodId, User } from './types';

export const DEMO_USER: User = {
  id: 'demo-user',
  name: 'Alex Rivera',
  email: 'alex@boltmood.app',
  joinedAt: '2025-01-12T08:00:00.000Z',
};

const SEED_TEMPLATE: Array<{ offset: number; mood: MoodId; note: string }> = [
  { offset: 38, mood: 'calm', note: 'Quiet morning walk before work really set the tone.' },
  { offset: 37, mood: 'motivated', note: 'Crushed the project presentation. Team loved it.' },
  { offset: 36, mood: 'neutral', note: '' },
  { offset: 35, mood: 'anxious', note: 'Big deadline creeping up, hard to focus.' },
  { offset: 34, mood: 'calm', note: 'Tried a new tea blend. Very relaxing evening.' },
  { offset: 33, mood: 'joyful', note: "Dinner with old friends — laughed until it hurt." },
  { offset: 32, mood: 'neutral', note: '' },
  { offset: 31, mood: 'sad', note: 'Missing home today. Called mom, which helped.' },
  { offset: 30, mood: 'motivated', note: 'Started the new book. Feeling inspired already.' },
  { offset: 29, mood: 'calm', note: 'Long run by the river. Mind feels clear.' },
  { offset: 28, mood: 'joyful', note: 'Weekend farmers market + fresh sourdough.' },
  { offset: 27, mood: 'angry', note: 'Frustrating commute and a flat tire on top of it.' },
  { offset: 26, mood: 'neutral', note: '' },
  { offset: 25, mood: 'motivated', note: 'Gym session felt great. Hit a new PR on deadlifts.' },
  { offset: 24, mood: 'calm', note: 'Slow Sunday. Read, napped, repeated.' },
  { offset: 23, mood: 'anxious', note: 'Pre-meeting jitters, but it went fine in the end.' },
  { offset: 22, mood: 'joyful', note: 'Got the apartment keys! New place, new chapter.' },
  { offset: 21, mood: 'motivated', note: 'Planned out the month. Feeling organized.' },
  { offset: 20, mood: 'neutral', note: '' },
  { offset: 19, mood: 'sad', note: 'Rainy day and a rough night of sleep.' },
  { offset: 18, mood: 'calm', note: 'Meditation before bed made a real difference.' },
  { offset: 17, mood: 'motivated', note: 'Finished the course I started in January.' },
  { offset: 16, mood: 'joyful', note: 'Saw the most incredible sunset from the rooftop.' },
  { offset: 15, mood: 'neutral', note: '' },
  { offset: 14, mood: 'anxious', note: 'Too much coffee, racing thoughts all afternoon.' },
  { offset: 13, mood: 'calm', note: 'Cooked a proper meal for the first time this week.' },
  { offset: 12, mood: 'motivated', note: 'Productive workday — cleared the whole backlog.' },
  { offset: 11, mood: 'joyful', note: 'Concert tonight. Ears still ringing, totally worth it.' },
  { offset: 10, mood: 'neutral', note: '' },
  { offset: 9, mood: 'sad', note: 'Tough conversation I had been putting off.' },
  { offset: 8, mood: 'calm', note: 'Took a mental health day. No guilt about it.' },
  { offset: 7, mood: 'motivated', note: 'Set up the new workspace. Ready to build.' },
  { offset: 6, mood: 'joyful', note: 'Brunch + board games. Perfect weekend start.' },
  { offset: 5, mood: 'neutral', note: '' },
  { offset: 4, mood: 'anxious', note: 'Waiting on test results. Trying to stay busy.' },
  { offset: 3, mood: 'calm', note: 'Results came back fine. Huge wave of relief.' },
  { offset: 2, mood: 'motivated', note: 'Booked flights for the summer trip.' },
  { offset: 1, mood: 'joyful', note: 'Slept in, sunshine, and slow coffee. Bliss.' },
];

const NOTES_BY_MOOD: Record<MoodId, string[]> = {
  joyful: ['Great vibes all day.', 'Everything just clicked today.', 'Smiled more than usual.'],
  calm: ['Quiet, steady day.', 'Felt grounded and present.', 'A peaceful kind of slow.'],
  motivated: ['Knocked out my to-do list.', 'Felt sharp and on it.', 'Ready for whatever is next.'],
  neutral: ['Just a regular day.', 'Nothing to report.', 'Fine, all things considered.'],
  anxious: ['Mind would not slow down.', 'A lot on my plate.', 'Felt jittery most of the day.'],
  sad: ['A heavy kind of day.', 'Low energy, low mood.', 'Needed some extra kindness today.'],
  angry: ['Small things added up.', 'Short fuse all day.', 'Needed space to cool off.'],
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Generate seeded mock entries ending yesterday (so "today" is open for the
 * user to log). Always deterministic for a given base date.
 */
export function generateSeedEntries(base: Date = new Date()): MoodEntry[] {
  const entries: MoodEntry[] = [];
  for (const t of SEED_TEMPLATE) {
    const d = new Date(base);
    d.setDate(d.getDate() - t.offset);
    const dateStr = toISODate(d);
    entries.push({
      id: `seed-${dateStr}`,
      date: dateStr,
      mood: t.mood,
      note: t.note,
      createdAt: new Date(d.getTime() - 1000 * 60 * 60 * 8).toISOString(),
    });
  }
  return entries;
}

export function pickNote(mood: MoodId): string {
  const pool = NOTES_BY_MOOD[mood];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function toISODateFromDate(d: Date): string {
  return toISODate(d);
}
