'use client';

import { useState } from 'react';
import { CHART_PRIMARY } from '@/lib/chart-colors';

interface Datum {
  month: string; // YYYY-MM
  count: number;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function label(month: string): string {
  const [year, m] = month.split('-');
  const index = Number(m) - 1;
  return `${MONTH_LABELS[index] ?? month} ${year?.slice(2) ?? ''}`;
}

/**
 * Counts per discrete month. Columns rather than a line: with only a handful
 * of months a line implies a continuous trend that two points cannot support.
 *
 * One series, so no legend — the heading names it.
 */
export function MonthColumns({ data }: { data: Datum[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-600">
        No enrolments yet.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div>
      {/*
        items-stretch, not items-end: each column must fill the row's height so
        the bar's percentage height has a definite parent to resolve against.
        With items-end the columns collapse to content height and every bar
        renders at zero.
      */}
      <div className="flex h-44 items-stretch gap-2" role="img" aria-label="Enrolments per month">
        {data.map((d, i) => {
          const heightPct = Math.max((d.count / max) * 100, 2);
          const isHovered = hovered === i;

          return (
            <div
              key={d.month}
              className="relative flex min-w-0 flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (
                <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-[var(--rule-strong)] bg-ink-800 px-2.5 py-1.5 font-mono text-[10px] text-bone-100 shadow-lg">
                  {label(d.month)} · {d.count}
                </div>
              )}
              <div
                className="w-full rounded-t-[4px] transition-[height,opacity] duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)]"
                style={{
                  height: `${heightPct}%`,
                  background: CHART_PRIMARY,
                  opacity: hovered !== null && !isHovered ? 0.45 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2 border-t border-[var(--rule)] pt-3">
        {data.map((d) => (
          <span
            key={d.month}
            className="min-w-0 flex-1 truncate text-center font-mono text-[9px] uppercase tracking-[0.1em] text-bone-600"
          >
            {label(d.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
