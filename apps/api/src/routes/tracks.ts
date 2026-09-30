import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonSummary, ProjectSummary, Track, TrackDetail } from '@internship/shared';
import { AppError } from '../errors.js';
import { requireParam } from '../params.js';

export interface TracksDeps {
  listTracks(): Promise<Track[]>;
  getTrackBySlug(slug: string): Promise<TrackDetail | null>;
}

interface TrackRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_inr: number;
  list_price_inr: number | null;
  duration_weeks: number;
  thumbnail_url: string | null;
  is_published: boolean;
  sort_order: number;
}

interface LessonRow {
  id: string;
  title: string;
  description: string;
  youtube_video_id: string;
  creator_name: string;
  duration_minutes: number;
  sort_order: number;
}

interface ProjectRow {
  id: string;
  title: string;
  brief_markdown: string;
  requirements: string;
}

export function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceInr: row.price_inr,
    listPriceInr: row.list_price_inr,
    durationWeeks: row.duration_weeks,
    thumbnailUrl: row.thumbnail_url,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
  };
}

function rowToLesson(row: LessonRow): LessonSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    youtubeVideoId: row.youtube_video_id,
    creatorName: row.creator_name ?? '',
    durationMinutes: row.duration_minutes,
    sortOrder: row.sort_order,
  };
}

function rowToProject(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    title: row.title,
    briefMarkdown: row.brief_markdown,
    requirements: row.requirements,
  };
}

export function createTracksDeps(supabase: SupabaseClient): TracksDeps {
  return {
    async listTracks() {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      if (error) throw new AppError(500, 'track_list_failed', error.message);
      return (data as TrackRow[]).map(rowToTrack);
    },

    async getTrackBySlug(slug) {
      const { data: track, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw new AppError(500, 'track_lookup_failed', error.message);
      if (!track) return null;

      const [{ data: lessons }, { data: project }] = await Promise.all([
        supabase
          .from('lessons')
          .select('id, title, description, youtube_video_id, creator_name, duration_minutes, sort_order')
          .eq('track_id', (track as TrackRow).id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('projects')
          .select('id, title, brief_markdown, requirements')
          .eq('track_id', (track as TrackRow).id)
          .maybeSingle(),
      ]);

      return {
        ...rowToTrack(track as TrackRow),
        lessons: ((lessons ?? []) as LessonRow[]).map(rowToLesson),
        project: project ? rowToProject(project as ProjectRow) : null,
      };
    },
  };
}

export function createTracksRouter(deps: TracksDeps): Router {
  const router = Router();

  router.get('/tracks', async (_req, res, next) => {
    try {
      const tracks = await deps.listTracks();
      // Belt and braces: the query already filters, but an unpublished track
      // must never reach a browser even if a future query forgets the filter.
      res.json(tracks.filter((t) => t.isPublished));
    } catch (err) {
      next(err);
    }
  });

  router.get('/tracks/:slug', async (req, res, next) => {
    try {
      const track = await deps.getTrackBySlug(requireParam(req, 'slug'));
      if (!track || !track.isPublished) {
        throw new AppError(404, 'not_found', 'Track not found');
      }
      res.json(track);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
