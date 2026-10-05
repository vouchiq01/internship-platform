/**
 * Marketing copy only. Anything a student can count — modules, duration,
 * price — comes from the database, not from here.
 */
export interface TrackMeta {
  code: string;
  slug: string;
  title: string;
  blurb: string;
  /** CSS custom-property name for this track's index colour. */
  accent: string;
  weeks: number;
  project: string;
}

/**
 * Marketing copy for the four launch tracks. The database is the source of
 * truth for price and publication state; this is presentation only.
 */
export const TRACKS: TrackMeta[] = [
  {
    code: 'DEV',
    slug: 'development',
    title: 'Development',
    blurb:
      'Ship a full-stack application with authentication, a real database and a deploy pipeline.',
    accent: 'var(--color-track-dev)',
    weeks: 8,
    project: 'Full-stack web application',
  },
  {
    code: 'QA',
    slug: 'qa',
    title: 'Quality Assurance',
    blurb:
      'Build an end-to-end automation suite that catches real regressions, not just green ticks.',
    accent: 'var(--color-track-qa)',
    weeks: 8,
    project: 'E2E automation framework',
  },
  {
    code: 'AI',
    slug: 'ai-engineering',
    title: 'AI Engineering',
    blurb:
      'Take a model from prompt to production — retrieval, evaluation, and cost you can defend.',
    accent: 'var(--color-track-ai)',
    weeks: 10,
    project: 'Retrieval-augmented application',
  },
  {
    code: 'OPS',
    slug: 'devops',
    title: 'DevOps',
    blurb:
      'Containerise, automate and observe a service until a deploy stops being frightening.',
    accent: 'var(--color-track-ops)',
    weeks: 8,
    project: 'CI/CD pipeline with monitoring',
  },
];
