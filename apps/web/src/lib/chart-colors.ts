/**
 * Chart palette — the brand track hues snapped into the dark-mode OKLCH
 * lightness band (L 0.48–0.67) so no series pops harder than another.
 *
 * Validated with the dataviz palette validator against surface #121013:
 * lightness band, chroma floor, CVD separation (worst adjacent ΔE 20.3
 * deutan), normal-vision floor (27.0) and contrast all pass.
 *
 * Tritan separation on the violet↔emerald pair is 5.9, below the comfortable
 * floor — every chart using these carries direct labels so identity is never
 * conveyed by colour alone.
 *
 * These are chart steps, not UI steps. The UI accents in globals.css are the
 * lighter brand values; do not swap one for the other.
 */
export const CHART_TRACK_COLORS: Record<string, string> = {
  development: '#636ef1',
  qa: '#00986b',
  'ai-engineering': '#9f52e4',
  devops: '#b86b00',
};

/** Single-series hue for the time chart. */
export const CHART_PRIMARY = '#636ef1';

export const chartColorFor = (slug: string) => CHART_TRACK_COLORS[slug] ?? CHART_PRIMARY;
