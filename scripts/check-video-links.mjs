#!/usr/bin/env node
/**
 * Verifies every YouTube video referenced by the curriculum still resolves
 * and is embeddable, using YouTube's public oEmbed endpoint (no API key).
 *
 * Creators delete videos and disable embedding without warning, and a dead
 * embed is a silent failure — the student sees an empty player and assumes
 * the product is broken. Run this on a schedule.
 *
 *   node scripts/check-video-links.mjs            # read ids from migrations
 *   node scripts/check-video-links.mjs ID [ID...] # check specific ids
 *
 * Exits non-zero if anything fails, so it can gate CI.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(here, '..', 'supabase', 'migrations');

async function idsFromMigrations() {
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
  const found = new Map(); // id -> context
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS, file), 'utf8');
    // Rows look like: …, 'VIDEOID', 'Creator', 27, 0)
    //
    // Anchoring on the numeric tail matters: a track slug such as
    // 'development' is itself exactly 11 characters of the YouTube alphabet
    // and matches a naive id pattern.
    const re = /'([A-Za-z0-9_-]{11})',\s*'([^']*)',\s*\d+,\s*\d+\)/g;
    let m;
    while ((m = re.exec(sql)) !== null) {
      if (m[1] === 'PLACEHOLDER') continue;
      found.set(m[1], m[2]);
    }
  }
  return [...found.entries()];
}

async function check(id) {
  const target = `https://www.youtube.com/watch?v=${id}`;
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const body = await res.json();
      return { ok: true, note: body.author_name ?? '' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, note: 'embedding disabled by the creator' };
    }
    if (res.status === 404) return { ok: false, note: 'video no longer exists' };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, note: `network error: ${err.message}` };
  }
}

const args = process.argv.slice(2);
const entries = args.length > 0 ? args.map((id) => [id, '']) : await idsFromMigrations();

if (entries.length === 0) {
  console.error('No video ids found. Has the curriculum migration been written?');
  process.exit(1);
}

console.log(`Checking ${entries.length} videos…\n`);

const failures = [];
for (const [id, context] of entries) {
  const { ok, note } = await check(id);
  const mark = ok ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${id}  ${note}${context ? `  — ${context}` : ''}`);
  if (!ok) failures.push({ id, note, context });
}

console.log('');
if (failures.length === 0) {
  console.log(`All ${entries.length} videos resolve and are embeddable.`);
  process.exit(0);
}

console.error(`${failures.length} of ${entries.length} FAILED:`);
for (const f of failures) {
  console.error(`  ${f.id} — ${f.note}${f.context ? ` (${f.context})` : ''}`);
}
console.error('\nReplace these from the admin track editor before a student hits them.');
process.exit(1);
