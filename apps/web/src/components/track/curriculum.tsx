import type { LessonSummary } from '@internship/shared';

export function Curriculum({ lessons, accent }: { lessons: LessonSummary[]; accent: string }) {
  if (lessons.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-600">
        Curriculum being finalised.
      </p>
    );
  }

  const totalMinutes = lessons.reduce((sum, l) => sum + l.durationMinutes, 0);

  return (
    <div>
      <ol>
        {lessons.map((lesson, i) => (
          <li
            key={lesson.id}
            className="group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-t border-[var(--rule)] py-5 transition-colors duration-400 hover:bg-ink-800/50"
            style={{ ['--accent' as string]: accent }}
          >
            <span className="font-mono text-[11px] tracking-[0.16em] text-bone-600 transition-colors duration-400 group-hover:text-[var(--accent)]">
              {String(i + 1).padStart(2, '0')}
            </span>

            <div>
              <h3 className="text-[15px] leading-snug text-bone-100">{lesson.title}</h3>
              {lesson.description && (
                <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-bone-600">
                  {lesson.description}
                </p>
              )}
              {lesson.creatorName && (
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-bone-600">
                  {lesson.creatorName}
                </p>
              )}
            </div>

            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-600">
              {lesson.durationMinutes}m
            </span>
          </li>
        ))}
      </ol>

      <p className="border-t border-[var(--rule)] pt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
        {lessons.length} modules · {Math.round(totalMinutes / 60)} hours of video
      </p>
    </div>
  );
}
