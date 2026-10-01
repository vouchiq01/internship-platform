import { createServerSupabase } from '@/lib/supabase/server';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Server-side fetch against the Express API, carrying the caller's JWT. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? res.statusText,
    );
  }

  return (await res.json()) as T;
}

/**
 * Unauthenticated fetch for the public catalogue. Deliberately separate from
 * apiFetch so a public page never triggers a Supabase session lookup.
 */
export async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? res.statusText,
    );
  }

  return (await res.json()) as T;
}

/** How a failed API call should be presented to the visitor. */
export type ApiFailure = 'not-found' | 'unauthorized' | 'unavailable';

/**
 * Decides what a failed request means for the page.
 *
 * The distinction that matters: "this thing does not exist" is a 404 the
 * visitor should see, but "we could not reach our own backend" is our problem
 * and must not be rendered as a crash. A public page that 500s when the API
 * hiccups loses a visitor who was deciding whether to pay us.
 *
 * Anything unrecognised is treated as unavailable rather than not-found, so a
 * backend outage never tells a visitor their track does not exist.
 */
export function classifyApiError(err: unknown): ApiFailure {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'not-found';
    if (err.status === 401 || err.status === 403) return 'unauthorized';
  }
  return 'unavailable';
}

/**
 * Logs a failure where the platform's log drain will pick it up. Degrading
 * gracefully must not mean failing silently — the visitor sees a calm page,
 * we still see the error.
 */
export function logApiFailure(context: string, err: unknown): void {
  const detail = err instanceof ApiError ? `${err.status} ${err.code}: ${err.message}` : String(err);
  console.error(`[api] ${context} failed — ${detail}`);
}
