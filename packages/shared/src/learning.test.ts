import { describe, expect, it } from 'vitest';
import { applyUnlockRules } from './learning.js';

const lesson = (i: number, completed: boolean) => ({
  id: `0000000${i}-0000-4000-8000-00000000000${i}`,
  title: `Lesson ${i}`,
  description: '',
  youtubeVideoId: 'abc',
  durationMinutes: 10,
  sortOrder: i,
  completed,
});

describe('applyUnlockRules', () => {
  it('unlocks the first lesson for a brand new student', () => {
    const [first, second] = applyUnlockRules([lesson(0, false), lesson(1, false)]);
    expect(first?.unlocked).toBe(true);
    expect(second?.unlocked).toBe(false);
  });

  it('unlocks the next lesson once the previous one is complete', () => {
    const result = applyUnlockRules([lesson(0, true), lesson(1, false), lesson(2, false)]);
    expect(result.map((l) => l.unlocked)).toEqual([true, true, false]);
  });

  it('unlocks everything when all lessons are complete', () => {
    const result = applyUnlockRules([lesson(0, true), lesson(1, true), lesson(2, true)]);
    expect(result.every((l) => l.unlocked)).toBe(true);
  });

  it('re-locks the tail if an earlier lesson is somehow incomplete', () => {
    // Defensive: a gap in progress must not unlock the rest of the track.
    const result = applyUnlockRules([lesson(0, true), lesson(1, false), lesson(2, true)]);
    expect(result.map((l) => l.unlocked)).toEqual([true, true, false]);
  });

  it('handles an empty track without throwing', () => {
    expect(applyUnlockRules([])).toEqual([]);
  });
});
