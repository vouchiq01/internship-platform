/**
 * A single headline figure. Deliberately not a chart — one number with no
 * trend behind it is a stat tile, and drawing a sparkline over two data
 * points would invent a story the data does not support.
 */
export function StatTile({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
}) {
  return (
    <div className="relative bg-ink-900 px-6 py-7">
      {accent && (
        <span
          className="absolute left-0 top-0 h-full w-[2px]"
          style={{ background: accent }}
          aria-hidden
        />
      )}
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-600">{label}</p>
      <p className="mt-3 font-display text-[2.75rem] leading-none tracking-[-0.02em]">{value}</p>
      {note && (
        <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-600">
          {note}
        </p>
      )}
    </div>
  );
}
