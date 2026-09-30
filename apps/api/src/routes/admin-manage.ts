import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  reorderLessonsSchema,
  upsertLessonSchema,
  upsertProjectSchema,
  upsertTrackSchema,
  type Track,
  type UpsertLessonInput,
  type UpsertProjectInput,
  type UpsertTrackInput,
} from '@internship/shared';
import { AppError } from '../errors.js';
import { requireParam } from '../params.js';

export interface AdminManageDeps {
  auth: RequestHandler;
  requireAdmin: RequestHandler;
  listAllTracks(): Promise<Track[]>;
  createTrack(input: UpsertTrackInput): Promise<{ id: string }>;
  updateTrack(id: string, input: UpsertTrackInput): Promise<void>;
  deleteTrack(id: string): Promise<void>;
  createLesson(input: UpsertLessonInput): Promise<{ id: string }>;
  updateLesson(id: string, input: UpsertLessonInput): Promise<void>;
  deleteLesson(id: string): Promise<void>;
  reorderLessons(trackId: string, lessonIds: string[]): Promise<void>;
  upsertProject(input: UpsertProjectInput): Promise<void>;
  revokeCertificate(id: string): Promise<boolean>;
  logAudit(action: string, entityId: string, metadata: Record<string, unknown>): Promise<void>;
}

/** Postgres unique-violation text, surfaced as a 409 rather than a 500. */
function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /duplicate key|unique constraint/i.test(message);
}

function parseOrThrow<T>(schema: { safeParse(v: unknown): { success: boolean; data?: T; error?: { issues: Array<{ message: string }> } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success || !parsed.data) {
    throw new AppError(
      400,
      'validation_failed',
      parsed.error?.issues[0]?.message ?? 'Invalid request',
    );
  }
  return parsed.data;
}

export function createAdminManageRouter(deps: AdminManageDeps): Router {
  const router = Router();
  const guard = [deps.auth, deps.requireAdmin] as const;

  // ---------- tracks ----------
  router.get('/tracks', ...guard, async (_req, res, next) => {
    try {
      res.json(await deps.listAllTracks());
    } catch (err) {
      next(err);
    }
  });

  router.post('/tracks', ...guard, async (req, res, next) => {
    try {
      const input = parseOrThrow<UpsertTrackInput>(upsertTrackSchema, req.body);
      if (input.listPriceInr != null && input.listPriceInr <= input.priceInr) {
        throw new AppError(
          400,
          'invalid_list_price',
          'The list price must be higher than the price you actually charge',
        );
      }
      const created = await deps.createTrack(input);
      res.status(201).json(created);
    } catch (err) {
      if (isUniqueViolation(err)) {
        next(new AppError(409, 'duplicate_slug', 'A track with that slug already exists'));
        return;
      }
      next(err);
    }
  });

  router.put('/tracks/:id', ...guard, async (req, res, next) => {
    try {
      const input = parseOrThrow<UpsertTrackInput>(upsertTrackSchema, req.body);
      if (input.listPriceInr != null && input.listPriceInr <= input.priceInr) {
        throw new AppError(400, 'invalid_list_price', 'The list price must be higher than the price');
      }
      await deps.updateTrack(requireParam(req, 'id'), input);
      res.json({ updated: true });
    } catch (err) {
      if (isUniqueViolation(err)) {
        next(new AppError(409, 'duplicate_slug', 'A track with that slug already exists'));
        return;
      }
      next(err);
    }
  });

  router.delete('/tracks/:id', ...guard, async (req, res, next) => {
    try {
      const id = requireParam(req, 'id');
      await deps.deleteTrack(id);
      await deps.logAudit('track.deleted', id, { actorId: req.auth!.id });
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  // ---------- lessons ----------
  router.post('/lessons', ...guard, async (req, res, next) => {
    try {
      const input = parseOrThrow<UpsertLessonInput>(upsertLessonSchema, req.body);
      res.status(201).json(await deps.createLesson(input));
    } catch (err) {
      next(err);
    }
  });

  router.put('/lessons/:id', ...guard, async (req, res, next) => {
    try {
      const input = parseOrThrow<UpsertLessonInput>(upsertLessonSchema, req.body);
      await deps.updateLesson(requireParam(req, 'id'), input);
      res.json({ updated: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/lessons/:id', ...guard, async (req, res, next) => {
    try {
      await deps.deleteLesson(requireParam(req, 'id'));
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/lessons/reorder', ...guard, async (req, res, next) => {
    try {
      const input = parseOrThrow(reorderLessonsSchema, req.body) as {
        trackId: string;
        lessonIds: string[];
      };

      // (track_id, sort_order) is unique. A duplicate id would try to write two
      // rows to the same position, so refuse before touching the database.
      if (new Set(input.lessonIds).size !== input.lessonIds.length) {
        throw new AppError(400, 'duplicate_lesson', 'The same lesson appears twice in the order');
      }

      await deps.reorderLessons(input.trackId, input.lessonIds);
      res.json({ reordered: true });
    } catch (err) {
      next(err);
    }
  });

  // ---------- project ----------
  router.put('/projects', ...guard, async (req, res, next) => {
    try {
      await deps.upsertProject(parseOrThrow<UpsertProjectInput>(upsertProjectSchema, req.body));
      res.json({ saved: true });
    } catch (err) {
      next(err);
    }
  });

  // ---------- certificates ----------
  router.post('/certificates/:id/revoke', ...guard, async (req, res, next) => {
    try {
      const id = requireParam(req, 'id');
      const revoked = await deps.revokeCertificate(id);
      if (!revoked) throw new AppError(404, 'not_found', 'Certificate not found');

      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : '';
      await deps.logAudit('certificate.revoked', id, { actorId: req.auth!.id, reason });
      res.json({ revoked: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createAdminManageDeps(
  supabase: SupabaseClient,
  auth: RequestHandler,
  requireAdmin: RequestHandler,
  rowToTrack: (row: never) => Track,
): AdminManageDeps {
  const throwOn = (error: { message: string } | null, code: string) => {
    if (error) throw new AppError(500, code, error.message);
  };

  return {
    auth,
    requireAdmin,

    async listAllTracks() {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('sort_order', { ascending: true });
      throwOn(error, 'track_list_failed');
      return ((data ?? []) as never[]).map(rowToTrack);
    },

    async createTrack(input) {
      const { data, error } = await supabase
        .from('tracks')
        .insert({
          slug: input.slug,
          title: input.title,
          description: input.description,
          price_inr: input.priceInr,
          list_price_inr: input.listPriceInr ?? null,
          duration_weeks: input.durationWeeks,
          is_published: input.isPublished,
          sort_order: input.sortOrder,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return { id: (data as { id: string }).id };
    },

    async updateTrack(id, input) {
      const { error } = await supabase
        .from('tracks')
        .update({
          slug: input.slug,
          title: input.title,
          description: input.description,
          price_inr: input.priceInr,
          list_price_inr: input.listPriceInr ?? null,
          duration_weeks: input.durationWeeks,
          is_published: input.isPublished,
          sort_order: input.sortOrder,
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },

    async deleteTrack(id) {
      const { error } = await supabase.from('tracks').delete().eq('id', id);
      throwOn(error, 'track_delete_failed');
    },

    async createLesson(input) {
      const { data, error } = await supabase
        .from('lessons')
        .insert({
          track_id: input.trackId,
          title: input.title,
          description: input.description,
          youtube_video_id: input.youtubeVideoId,
          duration_minutes: input.durationMinutes,
          sort_order: input.sortOrder,
        })
        .select('id')
        .single();
      throwOn(error, 'lesson_create_failed');
      return { id: (data as { id: string }).id };
    },

    async updateLesson(id, input) {
      const { error } = await supabase
        .from('lessons')
        .update({
          title: input.title,
          description: input.description,
          youtube_video_id: input.youtubeVideoId,
          duration_minutes: input.durationMinutes,
          sort_order: input.sortOrder,
        })
        .eq('id', id);
      throwOn(error, 'lesson_update_failed');
    },

    async deleteLesson(id) {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      throwOn(error, 'lesson_delete_failed');
    },

    async reorderLessons(trackId, lessonIds) {
      // (track_id, sort_order) is unique, so a direct rewrite would collide
      // mid-flight. Park everything above the used range first, then write the
      // final positions.
      const offset = 500;
      for (const [index, id] of lessonIds.entries()) {
        const { error } = await supabase
          .from('lessons')
          .update({ sort_order: offset + index })
          .eq('id', id)
          .eq('track_id', trackId);
        throwOn(error, 'lesson_reorder_failed');
      }
      for (const [index, id] of lessonIds.entries()) {
        const { error } = await supabase
          .from('lessons')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('track_id', trackId);
        throwOn(error, 'lesson_reorder_failed');
      }
    },

    async upsertProject(input) {
      const { error } = await supabase.from('projects').upsert(
        {
          track_id: input.trackId,
          title: input.title,
          brief_markdown: input.briefMarkdown,
          requirements: input.requirements,
        },
        { onConflict: 'track_id' },
      );
      throwOn(error, 'project_save_failed');
    },

    async revokeCertificate(id) {
      const { data, error } = await supabase
        .from('certificates')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .select('id');
      throwOn(error, 'certificate_revoke_failed');
      return (data ?? []).length > 0;
    },

    async logAudit(action, entityId, metadata) {
      await supabase.from('audit_log').insert({
        action,
        entity_type: 'admin',
        entity_id: entityId,
        metadata,
      });
    },
  };
}
