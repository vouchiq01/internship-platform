'use client';

import { useState } from 'react';
import { chartColorFor } from '@/lib/chart-colors';

interface Datum {
  trackTitle: string;
  trackSlug: string;
  count: number;
}

/**
 * Horizontal bars: four categories with long names, so the labels sit beside
 * the marks rather than rotated under them. Colour follows the track (the
 * entity), never its rank — reordering the data never repaints a series.
 *
 * Track names are always visible, which is the secondary encoding that makes
 * the violet/emerald pair safe for tritan viewers.
 */
export function TrackBars({ data }: { data: Datum[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-600">
        No enrolments yet.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        const share = total > 0 ? Math.round((d.count / total) * 100) : 0;
        const isHovered = hovered === d.trackSlug;

        return (
          <div
            key={d.trackSlug}
            onMouseEnter={() => setHovered(d.trackSlug)}
            onMouseLeave={() => setHovered(null)}
            className="group"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-bone-200">{d.trackTitle}</span>
              <span className="font-mono text-[11px] tabular-nums text-bone-400">
                {d.count}
                <span className="ml-2 text-bone-600">{share}%</span>
              </span>
            </div>

            <div className="mt-2 h-2.5 w-full bg-[var(--rule)]">
              <div
                className="h-full rounded-r-[4px] transition-[width,opacity] duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)]"
                style={{
                  width: `${pct}%`,
                  background: chartColorFor(d.trackSlug),
                  opacity: hovered && !isHovered ? 0.45 : 1,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
