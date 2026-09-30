'use client';

import type { EnrolledLesson } from '@internship/shared';

export function LessonRail({
  lessons,
  activeId,
  accent,
  onSelect,
}: {
  lessons: EnrolledLesson[];
  activeId: string | null;
  accent: string;
  onSelect: (id: string) => void;
}) {
  const completed = lessons.filter((l) => l.completed).length;
  const pct = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
            Progress
          </span>
          <span className="font-mono text-[10px] tracking-[0.12em] text-bone-200">
            {completed}/{lessons.length}
          </span>
        </div>
        <div className="mt-3 h-[3px] w-full bg-[var(--rule)]">
          <div
            className="h-full transition-[width] duration-700 ease-[cubic-bezier(0.16,0.84,0.28,1)]"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>
      </div>

      <ol>
        {lessons.map((lesson, i) => {
          const isActive = lesson.id === activeId;
          return (
            <li key={lesson.id}>
              <button
                type="button"
                disabled={!lesson.unlocked}
                onClick={() => onSelect(lesson.id)}
                aria-current={isActive ? 'step' : undefined}
                className={[
                  'group grid w-full grid-cols-[2rem_1fr] items-start gap-3 border-t border-[var(--rule)] py-4 pr-2 text-left transition-colors duration-300',
                  lesson.unlocked ? 'hover:bg-ink-800/60' : 'cursor-not-allowed opacity-40',
                  isActive ? 'bg-ink-800' : '',
                ].join(' ')}
              >
                <span className="font-mono text-[10px] tracking-[0.14em] text-bone-600">
                  {lesson.completed ? (
                    <span style={{ color: accent }}>✓</span>
                  ) : lesson.unlocked ? (
                    String(i + 1).padStart(2, '0')
                  ) : (
                    '—'
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm leading-snug ${isActive ? 'text-bone-100' : 'text-bone-400'}`}
                  >
                    {lesson.title}
                  </span>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
                    {lesson.durationMinutes}m
                    {!lesson.unlocked && ' · locked'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-[var(--rule)]" />
    </div>
  );
}
