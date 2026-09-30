/** Maps a track slug to its index colour. Keep in step with globals.css. */
const ACCENTS: Record<string, string> = {
  development: 'var(--color-track-dev)',
  qa: 'var(--color-track-qa)',
  'ai-engineering': 'var(--color-track-ai)',
  devops: 'var(--color-track-ops)',
};

const CODES: Record<string, string> = {
  development: 'DEV',
  qa: 'QA',
  'ai-engineering': 'AI',
  devops: 'OPS',
};

export const accentFor = (slug: string) => ACCENTS[slug] ?? 'var(--color-track-dev)';
export const codeFor = (slug: string) => CODES[slug] ?? slug.slice(0, 3).toUpperCase();
