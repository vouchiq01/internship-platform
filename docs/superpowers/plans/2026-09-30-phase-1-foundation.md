# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, authenticated skeleton — a student can sign up, sign in, and see an empty dashboard in production, with the full database schema in place.

**Architecture:** npm-workspaces monorepo. Next.js 15 on Vercel talks to Supabase **for authentication only**; all domain data flows through an Express API on Render that holds the `service_role` key. Shared Zod schemas in `packages/shared` are the contract between them.

**Tech Stack:** TypeScript 5.7 (strict), Node 24, npm workspaces, Next.js 16 (App Router), Express 5, Supabase (Postgres + Auth + Storage), Zod 3, `jose` for JWT verification, Vitest 5 + Supertest, Tailwind CSS 4.

> **Versions corrected during execution.** The pins originally written into
> this plan were stale and two carried security advisories. Actual versions:
> `next@16` (Next 15's postcss chain had a high-severity advisory; Next 16
> also renames `middleware.ts` to `proxy.ts`), `vitest@5` (critical advisory
> in the vite dev-server chain), `@supabase/ssr@0.12` and
> `@supabase/supabase-js@2.117`. `npm audit` reports zero vulnerabilities.
> Where a code block below says `middleware.ts`, the file is `src/proxy.ts`
> and the exported function is `proxy`, not `middleware`.

**Spec:** [`docs/superpowers/specs/2026-09-30-internship-platform-design.md`](../specs/2026-09-30-internship-platform-design.md)

## Global Constraints

- **Package manager is `npm`.** pnpm is broken on this machine (corepack cache miss). Do not run `pnpm` or `corepack`.
- **No Docker on this machine.** There is no local Supabase stack. Migrations are pushed to a hosted Supabase project via `supabase db push`.
- **Money is stored in paise as integers.** Never a float, never rupees.
- **The browser talks to Supabase for authentication only.** No domain table is ever read or written from the client. Every domain read/write goes through the Express API.
- **The JWT `role` claim is the Postgres role** (`authenticated`/`anon`), **not** the application role. Application authorisation reads `profiles.role`. Trusting the JWT `role` claim for admin access is a privilege-escalation bug.
- **No secret is ever exposed under a `NEXT_PUBLIC_` prefix.** `SUPABASE_SERVICE_ROLE_KEY` lives only on Render.
- **TypeScript `strict: true`** everywhere. No `any` in committed code.
- All tests run with `npm test` from the repo root.

---

## File Structure

```
internship-platform/
├── package.json                     workspaces root, shared scripts
├── tsconfig.base.json               strict TS config all packages extend
├── .env.example                     every env var, documented, no values
├── packages/shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 barrel export
│       ├── enums.ts                 UserRole, EnrollmentStatus, …
│       ├── profile.ts               Profile schema + Zod
│       └── profile.test.ts
├── apps/api/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 server bootstrap (listen)
│       ├── app.ts                   express app factory (no listen — testable)
│       ├── config.ts                env parsing + validation
│       ├── supabase.ts              service_role client singleton
│       ├── errors.ts                AppError + error-handling middleware
│       ├── middleware/
│       │   ├── auth.ts              JWT verification + role loading
│       │   └── auth.test.ts
│       └── routes/
│           ├── health.ts
│           ├── me.ts
│           └── me.test.ts
├── apps/web/
│   ├── package.json
│   ├── next.config.ts
│   ├── middleware.ts                Supabase session refresh
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx             placeholder landing
│       │   ├── (auth)/sign-in/page.tsx
│       │   ├── (auth)/sign-up/page.tsx
│       │   └── dashboard/page.tsx   protected
│       └── lib/
│           ├── supabase/client.ts   browser client
│           ├── supabase/server.ts   server-component client
│           └── api.ts               typed fetch wrapper → Express API
└── supabase/migrations/
    └── 20260930000001_initial_schema.sql
```

**Why `app.ts` is separate from `index.ts`:** the app factory returns an Express instance without binding a port, so Supertest can drive it in-process. Bootstrapping and listening stay in `index.ts`.

---

## Task 1: Monorepo foundation

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.env.example`, `.nvmrc`, `README.md`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: workspace `@internship/shared`; root scripts `npm run typecheck`, `npm test`, `npm run build`

- [ ] **Step 1: Create the workspace root**

`package.json`:

```json
{
  "name": "internship-platform",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build:shared": "npm run build --workspace @internship/shared",
    "build": "npm run build --workspaces --if-present",
    "dev:api": "npm run build:shared && npm run dev --workspace @internship/api",
    "dev:web": "npm run build:shared && npm run dev --workspace @internship/web"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

`.nvmrc`:

```
24
```

- [ ] **Step 2: Create the shared TypeScript config**

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

`noUncheckedIndexedAccess` is deliberate — it forces you to handle `array[0]` being `undefined`, which is exactly the class of bug that reaches production.

- [ ] **Step 3: Create the shared package**

`packages/shared/package.json`:

```json
{
  "name": "@internship/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

**This package must emit compiled JavaScript, not ship raw TypeScript.**
Node's type-stripping is deliberately disabled for files inside
`node_modules`, and npm workspaces symlinks this package there. A
`main` pointing at `src/index.ts` would typecheck locally, pass every test
under `tsx`, and then crash on Render with `Unknown file extension ".ts"`.
Anything that consumes `@internship/shared` must build it first.

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"]
}
```

`packages/shared/src/index.ts`:

```ts
export const PLACEHOLDER = true;
```

- [ ] **Step 4: Write `.env.example`**

```bash
# ---- Supabase (project settings → API) ----
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=            # RENDER ONLY. Never expose to the browser.

# ---- Express API (apps/api) ----
PORT=8080
WEB_ORIGIN=http://localhost:3000

# ---- Next.js (apps/web) ----
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8080
```

- [ ] **Step 5: Install and verify**

Run: `npm install && npm run build:shared && npm run typecheck`
Expected: installs, `packages/shared/dist/index.js` exists, `typecheck` passes.

`npm run build --workspaces` walks the `workspaces` array in declaration
order, and `packages/*` is listed before `apps/*` — so `@internship/shared`
is always compiled before anything that imports it. Do not reorder that array.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold npm-workspaces monorepo with shared TS config"
```

---

## Task 2: Shared domain schemas

**Files:**
- Create: `packages/shared/src/enums.ts`, `packages/shared/src/profile.ts`, `packages/shared/src/profile.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `zod`
- Produces:
  - `UserRole` = `'student' | 'admin'`, `USER_ROLES` readonly tuple
  - `EnrollmentStatus`, `PaymentStatus`, `SubmissionStatus` (same shape)
  - `profileSchema: ZodObject` → `Profile` type
  - `updateProfileSchema: ZodObject` → `UpdateProfileInput` type

- [ ] **Step 1: Write the failing test**

`packages/shared/src/profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { profileSchema, updateProfileSchema } from './profile.js';

describe('profileSchema', () => {
  const valid = {
    id: '3f6b7a1e-9c0d-4e2f-8a1b-2c3d4e5f6a7b',
    email: 'student@example.com',
    fullName: 'Asha Kumar',
    phone: null,
    college: null,
    graduationYear: null,
    role: 'student',
    createdAt: '2026-09-30T10:00:00.000Z',
  };

  it('accepts a valid profile', () => {
    expect(profileSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a non-uuid id', () => {
    expect(() => profileSchema.parse({ ...valid, id: 'nope' })).toThrow();
  });

  it('rejects an unknown role', () => {
    expect(() => profileSchema.parse({ ...valid, role: 'superadmin' })).toThrow();
  });
});

describe('updateProfileSchema', () => {
  it('accepts a partial update', () => {
    expect(updateProfileSchema.parse({ college: 'NIT Trichy' }))
      .toEqual({ college: 'NIT Trichy' });
  });

  it('rejects a graduation year outside a sane range', () => {
    expect(() => updateProfileSchema.parse({ graduationYear: 1899 })).toThrow();
  });

  it('does not allow role to be self-assigned', () => {
    const parsed = updateProfileSchema.parse({ role: 'admin' } as never);
    expect(parsed).not.toHaveProperty('role');
  });
});
```

That last test is the important one. `role` must be strippable by the schema so a student cannot PATCH themselves to admin.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @internship/shared`
Expected: FAIL — `Cannot find module './profile.js'`

- [ ] **Step 3: Write the enums**

`packages/shared/src/enums.ts`:

```ts
import { z } from 'zod';

export const USER_ROLES = ['student', 'admin'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const ENROLLMENT_STATUSES = ['pending_payment', 'active', 'completed'] as const;
export const enrollmentStatusSchema = z.enum(ENROLLMENT_STATUSES);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

export const PAYMENT_STATUSES = ['created', 'paid', 'failed', 'refunded'] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
```

- [ ] **Step 4: Write the profile schemas**

`packages/shared/src/profile.ts`:

```ts
import { z } from 'zod';
import { userRoleSchema } from './enums.js';

export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().nullable(),
  college: z.string().nullable(),
  graduationYear: z.number().int().nullable(),
  role: userRoleSchema,
  createdAt: z.string().datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * Fields a student may change about themselves.
 * `role` is deliberately absent — it is set by an admin, never by the user.
 * `.strict()` is NOT used: unknown keys are stripped rather than rejected,
 * so a client sending `role` gets it silently dropped instead of a 400.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().min(7).max(20).nullable().optional(),
  college: z.string().min(1).max(200).nullable().optional(),
  graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

- [ ] **Step 5: Export from the barrel**

`packages/shared/src/index.ts`:

```ts
export * from './enums.js';
export * from './profile.js';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test --workspace @internship/shared`
Expected: PASS — 6 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add domain enums and profile schemas"
```

---

## Task 3: Database schema

**Files:**
- Create: `supabase/migrations/20260930000001_initial_schema.sql`
- Create: `supabase/README.md`

**Interfaces:**
- Consumes: nothing
- Produces: all 10 tables, 4 enums, the `handle_new_user` trigger, RLS enabled deny-all on every table.

**Prerequisite (human, one time):** create a free Supabase project at supabase.com, then:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

`supabase db push` works against a hosted project without Docker.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260930000001_initial_schema.sql`:

```sql
-- ============================================================
-- Internship Platform — initial schema
-- ============================================================

create type user_role         as enum ('student', 'admin');
create type enrollment_status as enum ('pending_payment', 'active', 'completed');
create type payment_status    as enum ('created', 'paid', 'failed', 'refunded');
create type submission_status as enum ('pending', 'approved', 'rejected');

-- ---------- profiles ----------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text        not null,
  full_name       text        not null default '',
  phone           text,
  college         text,
  graduation_year int,
  role            user_role   not null default 'student',
  created_at      timestamptz not null default now()
);

-- ---------- tracks ----------
create table public.tracks (
  id             uuid primary key default gen_random_uuid(),
  slug           text        not null unique,
  title          text        not null,
  description    text        not null default '',
  price_inr      int         not null check (price_inr >= 0),
  duration_weeks int         not null check (duration_weeks > 0),
  thumbnail_url  text,
  is_published   boolean     not null default false,
  sort_order     int         not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- lessons ----------
create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  track_id         uuid        not null references public.tracks(id) on delete cascade,
  title            text        not null,
  description      text        not null default '',
  youtube_video_id text        not null,
  duration_minutes int         not null default 0 check (duration_minutes >= 0),
  sort_order       int         not null,
  created_at       timestamptz not null default now(),
  unique (track_id, sort_order)
);

-- ---------- enrollments ----------
create table public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid              not null references public.profiles(id) on delete cascade,
  track_id     uuid              not null references public.tracks(id)   on delete restrict,
  status       enrollment_status not null default 'pending_payment',
  enrolled_at  timestamptz       not null default now(),
  completed_at timestamptz,
  unique (user_id, track_id)
);

-- ---------- lesson_progress ----------
create table public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid        not null references public.enrollments(id) on delete cascade,
  lesson_id     uuid        not null references public.lessons(id)     on delete cascade,
  completed_at  timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

-- ---------- payments ----------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid           not null references public.profiles(id) on delete restrict,
  track_id            uuid           not null references public.tracks(id)   on delete restrict,
  razorpay_order_id   text           not null unique,
  razorpay_payment_id text,
  razorpay_signature  text,
  amount_paise        bigint         not null check (amount_paise > 0),
  currency            text           not null default 'INR',
  status              payment_status not null default 'created',
  created_at          timestamptz    not null default now(),
  paid_at             timestamptz
);

-- ---------- projects ----------
create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  track_id       uuid        not null references public.tracks(id) on delete cascade,
  title          text        not null,
  brief_markdown text        not null default '',
  requirements   text        not null default '',
  created_at     timestamptz not null default now(),
  unique (track_id)
);

-- ---------- submissions ----------
create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid              not null references public.enrollments(id) on delete cascade,
  project_id      uuid              not null references public.projects(id)    on delete cascade,
  github_url      text              not null,
  live_url        text,
  notes           text              not null default '',
  file_url        text,
  status          submission_status not null default 'pending',
  attempt_number  int               not null default 1 check (attempt_number > 0),
  reviewer_id     uuid              references public.profiles(id) on delete set null,
  review_feedback text,
  submitted_at    timestamptz       not null default now(),
  reviewed_at     timestamptz,
  unique (enrollment_id, attempt_number)
);

-- ---------- certificates ----------
create table public.certificates (
  id                    uuid primary key default gen_random_uuid(),
  enrollment_id         uuid        not null unique references public.enrollments(id) on delete restrict,
  certificate_number    text        not null unique,
  student_name_snapshot text        not null,
  track_title_snapshot  text        not null,
  issued_at             timestamptz not null default now(),
  pdf_url               text,
  revoked_at            timestamptz
);

-- ---------- audit_log ----------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid        references public.profiles(id) on delete set null,
  action      text        not null,
  entity_type text        not null,
  entity_id   uuid,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- indexes ----------
create index idx_lessons_track          on public.lessons(track_id, sort_order);
create index idx_enrollments_user       on public.enrollments(user_id);
create index idx_enrollments_track      on public.enrollments(track_id);
create index idx_progress_enrollment    on public.lesson_progress(enrollment_id);
create index idx_payments_user          on public.payments(user_id);
create index idx_submissions_status     on public.submissions(status, submitted_at);
create index idx_submissions_enrollment on public.submissions(enrollment_id);
create index idx_audit_entity           on public.audit_log(entity_type, entity_id);

-- ---------- auto-create a profile for every new auth user ----------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
-- Enabled with NO policies on every table. That is deny-all for the `anon`
-- and `authenticated` roles. `service_role` bypasses RLS, and the Express API
-- is the only thing holding that key. This is defence-in-depth: if the anon
-- key ever leaks, it still reads nothing.
alter table public.profiles        enable row level security;
alter table public.tracks          enable row level security;
alter table public.lessons         enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.payments        enable row level security;
alter table public.projects        enable row level security;
alter table public.submissions     enable row level security;
alter table public.certificates    enable row level security;
alter table public.audit_log       enable row level security;
```

- [ ] **Step 2: Push the migration**

Run: `supabase db push`
Expected: the migration applies with no errors.

- [ ] **Step 3: Verify the schema landed**

Run:

```bash
supabase db execute --query "select table_name from information_schema.tables where table_schema='public' order by 1"
```

Expected exactly these 10 rows: `audit_log`, `certificates`, `enrollments`, `lesson_progress`, `lessons`, `payments`, `profiles`, `projects`, `submissions`, `tracks`.

- [ ] **Step 4: Verify the trigger works**

In the Supabase dashboard → Authentication → Users → **Add user** (email `trigger-test@example.com`). Then:

```bash
supabase db execute --query "select id, email, role from public.profiles where email='trigger-test@example.com'"
```

Expected: one row, `role = student`. Delete the test user afterwards.

If no row appears, the trigger did not fire — check Supabase logs for a `handle_new_user` error before continuing. Every later task depends on this.

- [ ] **Step 5: Write `supabase/README.md`**

```markdown
# Database

Migrations are plain SQL in `migrations/`, applied to the hosted project.
There is no local Docker stack on this machine.

## Setup (once)

    npm i -g supabase
    supabase login
    supabase link --project-ref <project-ref>

## Apply migrations

    supabase db push

## Conventions

- Tables and columns are `snake_case`. The API maps to `camelCase` at the boundary.
- Money is stored in **paise** as `bigint`. Never rupees, never a float.
- RLS is enabled with no policies on every table — deny-all by design.
  Only the Express API connects, using `service_role`, which bypasses RLS.
- Never edit an applied migration. Add a new one.

## Promoting an admin

    update public.profiles set role = 'admin' where email = 'you@example.com';
```

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): add initial schema, profile trigger, and deny-all RLS"
```

---

## Task 4: Express API skeleton

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`
- Create: `apps/api/src/config.ts`, `apps/api/src/errors.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`
- Create: `apps/api/src/routes/health.ts`, `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `loadConfig(env: NodeJS.ProcessEnv): Config` — throws on missing vars
  - `createApp(config: Config): express.Express` — no `listen`
  - `AppError` class: `new AppError(status: number, code: string, message: string)`
  - `GET /health` → `200 { status: 'ok' }`

- [ ] **Step 1: Create the package**

`apps/api/package.json`:

```json
{
  "name": "@internship/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@internship/shared": "*",
    "@supabase/supabase-js": "^2.47.10",
    "cors": "^2.8.5",
    "express": "^5.0.1",
    "jose": "^5.9.6",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { Config } from './config.js';

const testConfig: Config = {
  port: 8080,
  supabaseUrl: 'https://test.supabase.co',
  supabaseServiceRoleKey: 'test-service-role-key',
  webOrigin: 'http://localhost:3000',
};

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(createApp(testConfig)).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('unknown routes', () => {
  it('returns a structured 404', async () => {
    const res = await request(createApp(testConfig)).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace @internship/api`
Expected: FAIL — `Cannot find module './app.js'`

- [ ] **Step 4: Write the config loader**

`apps/api/src/config.ts`:

```ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WEB_ORIGIN: z.string().url(),
});

export interface Config {
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  webOrigin: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${missing}`);
  }
  return {
    port: parsed.data.PORT,
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    webOrigin: parsed.data.WEB_ORIGIN,
  };
}
```

Failing loudly at boot on a missing env var is the point. A server that starts and then 500s on every request is much harder to diagnose than one that refuses to start.

- [ ] **Step 5: Write the error types**

`apps/api/src/errors.ts`:

```ts
import type { ErrorRequestHandler, RequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // Never leak an unexpected error's message to the client.
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong' },
  });
};
```

- [ ] **Step 6: Write the health route and app factory**

`apps/api/src/routes/health.ts`:

```ts
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
```

`apps/api/src/app.ts`:

```ts
import express from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { healthRouter } from './routes/health.js';

export function createApp(config: Config): express.Express {
  const app = express();

  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

Order matters: `notFoundHandler` must come after every route, and `errorHandler` must be last — Express identifies error middleware by its four-argument signature.

- [ ] **Step 7: Write the server bootstrap**

`apps/api/src/index.ts`:

```ts
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm install && npm test --workspace @internship/api`
Expected: PASS — 2 tests.

- [ ] **Step 9: Commit**

```bash
git add apps/api
git commit -m "feat(api): add Express app factory, config loading, and health route"
```

---

## Task 5: JWT authentication middleware

**Files:**
- Create: `apps/api/src/supabase.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/auth.test.ts`

**Interfaces:**
- Consumes: `AppError` (Task 4), `UserRole` (Task 2)
- Produces:
  - `AuthUser` = `{ id: string; email: string; role: UserRole }`
  - `Request.auth?: AuthUser` (Express type augmentation)
  - `createAuthMiddleware(deps: AuthDeps): RequestHandler` — verifies the JWT, loads `profiles.role`
  - `requireAdmin: RequestHandler` — 403 unless `req.auth.role === 'admin'`
  - `AuthDeps` = `{ verifyToken(token: string): Promise<{ sub: string; email?: string }>; loadRole(userId: string): Promise<UserRole | null> }`

The dependency-injection shape is deliberate: it lets the tests verify real
signature checking against a locally generated key pair, with no network and
no Supabase project.

- [ ] **Step 1: Write the failing test**

`apps/api/src/middleware/auth.test.ts`:

```ts
import { describe, expect, it, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SignJWT, exportJWK, generateKeyPair, jwtVerify, createLocalJWKSet } from 'jose';
import type { UserRole } from '@internship/shared';
import { createAuthMiddleware, requireAdmin } from './auth.js';
import { errorHandler } from '../errors.js';

let signToken: (sub: string, expSeconds?: number) => Promise<string>;
let verifyToken: (token: string) => Promise<{ sub: string; email?: string }>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };
  const jwks = createLocalJWKSet({ keys: [jwk] });

  signToken = (sub, expSeconds = 3600) =>
    new SignJWT({ email: `${sub}@example.com`, role: 'authenticated' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expSeconds)
      .sign(privateKey);

  verifyToken = async (token) => {
    const { payload } = await jwtVerify(token, jwks);
    return { sub: payload.sub as string, email: payload.email as string | undefined };
  };
});

function buildApp(roles: Record<string, UserRole>) {
  const app = express();
  const auth = createAuthMiddleware({
    verifyToken,
    loadRole: async (userId) => roles[userId] ?? null,
  });
  app.get('/whoami', auth, (req, res) => res.json(req.auth));
  app.get('/admin-only', auth, requireAdmin, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('createAuthMiddleware', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(buildApp({})).get('/whoami');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(buildApp({}))
      .get('/whoami')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects a token with a bad signature', async () => {
    const token = await signToken('user-1');
    const tampered = `${token.slice(0, -4)}AAAA`;
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/whoami')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await signToken('user-1', -60);
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a valid token with no matching profile', async () => {
    const token = await signToken('ghost');
    const res = await request(buildApp({}))
      .get('/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('profile_not_found');
  });

  it('attaches the user on a valid token', async () => {
    const token = await signToken('user-1');
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'user-1',
      email: 'user-1@example.com',
      role: 'student',
    });
  });
});

describe('requireAdmin', () => {
  it('rejects a student', async () => {
    const token = await signToken('user-1');
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('allows an admin', async () => {
    const token = await signToken('boss');
    const res = await request(buildApp({ boss: 'admin' }))
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('ignores a forged app role in the token body', async () => {
    // The token claims role=authenticated (a Postgres role). The app role must
    // come from the profiles table, never from the token.
    const token = await signToken('sneaky');
    const res = await request(buildApp({ sneaky: 'student' }))
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @internship/api`
Expected: FAIL — `Cannot find module './auth.js'`

- [ ] **Step 3: Write the Supabase service client**

`apps/api/src/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';

/**
 * Service-role client. Bypasses RLS entirely — this is the ONLY thing that
 * touches domain tables. Never construct this in code that runs in a browser.
 */
export function createServiceClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 4: Write the auth middleware**

`apps/api/src/middleware/auth.ts`:

```ts
import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@internship/shared';
import { AppError } from '../errors.js';
import type { Config } from '../config.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export interface AuthDeps {
  verifyToken(token: string): Promise<{ sub: string; email?: string }>;
  loadRole(userId: string): Promise<UserRole | null>;
}

/** Production wiring: verify against the project's JWKS, read role from profiles. */
export function createAuthDeps(config: Config, supabase: SupabaseClient): AuthDeps {
  const jwks = createRemoteJWKSet(
    new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`),
  );

  return {
    async verifyToken(token) {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${config.supabaseUrl}/auth/v1`,
      });
      return {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
      };
    },
    async loadRole(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new AppError(500, 'profile_lookup_failed', error.message);
      return (data?.role as UserRole | undefined) ?? null;
    },
  };
}

export function createAuthMiddleware(deps: AuthDeps): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new AppError(401, 'unauthenticated', 'Missing bearer token');
      }

      const token = header.slice('Bearer '.length).trim();

      let claims: { sub: string; email?: string };
      try {
        claims = await deps.verifyToken(token);
      } catch {
        // Deliberately opaque: never tell a caller *why* their token failed.
        throw new AppError(401, 'unauthenticated', 'Invalid or expired token');
      }

      if (!claims.sub) {
        throw new AppError(401, 'unauthenticated', 'Token has no subject');
      }

      // The app role comes from the database, NEVER from the token. The token's
      // own `role` claim is the Postgres role and is not an authorisation grant.
      const role = await deps.loadRole(claims.sub);
      if (!role) {
        throw new AppError(401, 'profile_not_found', 'No profile for this user');
      }

      req.auth = { id: claims.sub, email: claims.email ?? '', role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'admin') {
    next(new AppError(403, 'forbidden', 'Admin access required'));
    return;
  }
  next();
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace @internship/api`
Expected: PASS — 11 tests total.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): add JWT auth middleware with DB-sourced role authorisation"
```

---

## Task 6: `/api/me` routes

**Files:**
- Create: `apps/api/src/routes/me.ts`, `apps/api/src/routes/me.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `createAuthMiddleware` (Task 5), `updateProfileSchema`, `Profile` (Task 2)
- Produces:
  - `createMeRouter(deps: MeDeps): Router` mounting `GET /api/me` and `PATCH /api/me`
  - `MeDeps` = `{ auth: RequestHandler; getProfile(id): Promise<Profile | null>; updateProfile(id, input): Promise<Profile> }`
  - `createApp(config, overrides?)` — `overrides.meDeps` lets tests inject fakes

- [ ] **Step 1: Write the failing test**

`apps/api/src/routes/me.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { Profile } from '@internship/shared';
import { createMeRouter } from './me.js';
import { errorHandler } from '../errors.js';

const profile: Profile = {
  id: 'user-1',
  email: 'student@example.com',
  fullName: 'Asha Kumar',
  phone: null,
  college: null,
  graduationYear: null,
  role: 'student',
  createdAt: '2026-09-30T10:00:00.000Z',
};

const fakeAuth: RequestHandler = (req, _res, next) => {
  req.auth = { id: 'user-1', email: profile.email, role: 'student' };
  next();
};

function buildApp(store: Profile | null = profile) {
  let current = store;
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createMeRouter({
      auth: fakeAuth,
      getProfile: async () => current,
      updateProfile: async (_id, input) => {
        if (!current) throw new Error('no profile');
        current = { ...current, ...input };
        return current;
      },
    }),
  );
  app.use(errorHandler);
  return app;
}

describe('GET /api/me', () => {
  it('returns the caller profile', async () => {
    const res = await request(buildApp()).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(profile);
  });

  it('returns 404 when the profile is missing', async () => {
    const res = await request(buildApp(null)).get('/api/me');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/me', () => {
  it('updates allowed fields', async () => {
    const res = await request(buildApp())
      .patch('/api/me')
      .send({ college: 'NIT Trichy', graduationYear: 2027 });
    expect(res.status).toBe(200);
    expect(res.body.college).toBe('NIT Trichy');
    expect(res.body.graduationYear).toBe(2027);
  });

  it('silently ignores an attempt to self-assign admin', async () => {
    const res = await request(buildApp())
      .patch('/api/me')
      .send({ fullName: 'Asha K', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('student');
  });

  it('rejects an invalid graduation year', async () => {
    const res = await request(buildApp())
      .patch('/api/me')
      .send({ graduationYear: 1899 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @internship/api`
Expected: FAIL — `Cannot find module './me.js'`

- [ ] **Step 3: Write the router**

`apps/api/src/routes/me.ts`:

```ts
import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  updateProfileSchema,
  type Profile,
  type UpdateProfileInput,
} from '@internship/shared';
import { AppError } from '../errors.js';

export interface MeDeps {
  auth: RequestHandler;
  getProfile(id: string): Promise<Profile | null>;
  updateProfile(id: string, input: UpdateProfileInput): Promise<Profile>;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  college: string | null;
  graduation_year: number | null;
  role: Profile['role'];
  created_at: string;
}

/** The single place snake_case DB columns become camelCase API fields. */
export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    college: row.college,
    graduationYear: row.graduation_year,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function createMeDeps(supabase: SupabaseClient, auth: RequestHandler): MeDeps {
  return {
    auth,
    async getProfile(id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new AppError(500, 'profile_lookup_failed', error.message);
      return data ? rowToProfile(data as ProfileRow) : null;
    },
    async updateProfile(id, input) {
      const patch: Record<string, unknown> = {};
      if (input.fullName !== undefined) patch.full_name = input.fullName;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.college !== undefined) patch.college = input.college;
      if (input.graduationYear !== undefined) patch.graduation_year = input.graduationYear;

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new AppError(500, 'profile_update_failed', error.message);
      return rowToProfile(data as ProfileRow);
    },
  };
}

export function createMeRouter(deps: MeDeps): Router {
  const router = Router();

  router.get('/me', deps.auth, async (req, res, next) => {
    try {
      const profile = await deps.getProfile(req.auth!.id);
      if (!profile) throw new AppError(404, 'not_found', 'Profile not found');
      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/me', deps.auth, async (req, res, next) => {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'validation_failed', parsed.error.issues[0]?.message ?? 'Invalid body');
      }
      // parsed.data has already had unknown keys (including `role`) stripped.
      const updated = await deps.updateProfile(req.auth!.id, parsed.data);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Wire it into the app**

Replace `apps/api/src/app.ts` with:

```ts
import express from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { healthRouter } from './routes/health.js';
import { createMeRouter, type MeDeps } from './routes/me.js';

export interface AppOverrides {
  meDeps?: MeDeps;
}

export function createApp(config: Config, overrides: AppOverrides = {}): express.Express {
  const app = express();

  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  if (overrides.meDeps) {
    app.use('/api', createMeRouter(overrides.meDeps));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

Replace `apps/api/src/index.ts` with:

```ts
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServiceClient } from './supabase.js';
import { createAuthDeps, createAuthMiddleware } from './middleware/auth.js';
import { createMeDeps } from './routes/me.js';

const config = loadConfig(process.env);
const supabase = createServiceClient(config);
const auth = createAuthMiddleware(createAuthDeps(config, supabase));

const app = createApp(config, { meDeps: createMeDeps(supabase, auth) });

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace @internship/api`
Expected: PASS — 16 tests total.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): add GET and PATCH /api/me with field allow-listing"
```

---

## Task 7: Next.js app with Supabase session

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/middleware.ts`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/supabase/client.ts`, `apps/web/src/lib/supabase/server.ts`, `apps/web/src/lib/api.ts`

**Interfaces:**
- Consumes: `Profile` (Task 2), the API from Tasks 4–6
- Produces:
  - `createBrowserSupabase()` — client component use
  - `createServerSupabase()` — server component / route handler use
  - `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` — attaches the bearer token automatically

- [ ] **Step 1: Create the package**

`apps/web/package.json`:

```json
{
  "name": "@internship/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@internship/shared": "*",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "next": "^15.1.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2023"],
    "jsx": "preserve",
    "noEmit": true,
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@internship/shared'],
};

export default config;
```

`transpilePackages` makes Next re-process the workspace package rather than
treating it as an opaque external. `@internship/shared` must still be built
(`npm run build:shared`) before the web app builds — the `dev:web` and
`build` scripts in Task 1 do that for you.

- [ ] **Step 2: Write the Supabase clients**

`apps/web/src/lib/supabase/client.ts`:

```ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`apps/web/src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, which cannot set cookies.
            // middleware.ts refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Write the session-refresh middleware**

`apps/web/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Must be getUser(), not getSession(). getUser() revalidates the token with
  // the Auth server; getSession() trusts the cookie, which is spoofable.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 4: Write the typed API client**

`apps/web/src/lib/api.ts`:

```ts
import { createServerSupabase } from '@/lib/supabase/server';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Server-side fetch against the Express API, carrying the caller's JWT. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

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
```

Using `getSession()` here is correct: middleware has already revalidated the
user on this request, and we need the raw `access_token` to forward.

- [ ] **Step 5: Write the root layout and placeholder landing page**

`apps/web/src/app/globals.css`:

```css
@import "tailwindcss";
```

`apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Internship Platform',
  description: 'Industry internships for engineering students',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx`:

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Internship Platform</h1>
      <p className="text-slate-400">
        Phase 1 skeleton. Tracks and enrolment arrive in Phase 2.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-in" className="rounded-lg bg-indigo-500 px-4 py-2 font-medium">
          Sign in
        </Link>
        <Link href="/sign-up" className="rounded-lg border border-slate-700 px-4 py-2">
          Create account
        </Link>
      </div>
    </main>
  );
}
```

This landing page is a placeholder. The real one is designed in Phase 2.

- [ ] **Step 6: Add PostCSS config**

`apps/web/postcss.config.mjs`:

```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

- [ ] **Step 7: Verify it builds and runs**

Run: `npm install && npm run build --workspace @internship/web`
Expected: build succeeds.

Then `npm run dev:web` and open `http://localhost:3000` — the landing page renders.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold Next.js app with Supabase session handling"
```

---

## Task 8: Auth pages and protected dashboard

**Files:**
- Create: `apps/web/src/app/(auth)/sign-in/page.tsx`, `apps/web/src/app/(auth)/sign-up/page.tsx`
- Create: `apps/web/src/app/(auth)/auth-form.tsx`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/dashboard/sign-out-button.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabase` (Task 7), `apiFetch` (Task 7), `Profile` (Task 2)
- Produces: working sign-up, sign-in, sign-out, and a `/dashboard` that renders the caller's profile fetched through the Express API

- [ ] **Step 1: Write the shared auth form**

`apps/web/src/app/(auth)/auth-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error: authError } =
      mode === 'sign-up'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setPending(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
      </h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === 'sign-up' && (
          <label className="flex flex-col gap-1.5 text-sm">
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-500 px-4 py-2 font-medium disabled:opacity-50"
        >
          {pending ? 'Working…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-400">
        {mode === 'sign-up' ? (
          <>Already have an account? <Link href="/sign-in" className="underline">Sign in</Link></>
        ) : (
          <>No account? <Link href="/sign-up" className="underline">Create one</Link></>
        )}
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Write the two auth pages**

`apps/web/src/app/(auth)/sign-in/page.tsx`:

```tsx
import { AuthForm } from '../auth-form';

export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}
```

`apps/web/src/app/(auth)/sign-up/page.tsx`:

```tsx
import { AuthForm } from '../auth-form';

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
```

- [ ] **Step 3: Write the email-confirmation callback**

`apps/web/src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
```

- [ ] **Step 4: Write the sign-out button**

`apps/web/src/app/dashboard/sign-out-button.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 5: Write the dashboard**

`apps/web/src/app/dashboard/page.tsx`:

```tsx
import type { Profile } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { SignOutButton } from './sign-out-button';

export default async function DashboardPage() {
  let profile: Profile | null = null;
  let loadError: string | null = null;

  try {
    profile = await apiFetch<Profile>('/api/me');
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? `Could not load your profile (${err.code})`
        : 'Could not reach the API';
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <SignOutButton />
      </header>

      {loadError ? (
        <p role="alert" className="text-red-400">{loadError}</p>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-lg font-medium">{profile?.fullName || profile?.email}</p>
          <p className="text-sm text-slate-400">{profile?.email}</p>
          <p className="mt-4 text-sm text-slate-400">
            You are not enrolled in any track yet. Tracks arrive in Phase 2.
          </p>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Verify the whole loop by hand**

Start both apps: `npm run dev:api` and `npm run dev:web`.

Check each of these:

1. Visit `/dashboard` while signed out → redirected to `/sign-in`
2. Create an account at `/sign-up` → lands on `/dashboard`
3. The dashboard shows your name and email (proves the JWT reached Express, was verified against JWKS, and the profile trigger fired)
4. Sign out → back to `/`
5. Sign in again → dashboard loads
6. Confirm a `profiles` row exists with `role = 'student'`

If step 3 shows an error, check in this order: is the API running; is `NEXT_PUBLIC_API_URL` correct; does `SUPABASE_URL` on the API match the web app's project.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add sign-up, sign-in, sign-out, and protected dashboard"
```

---

## Task 9: Deployment

**Files:**
- Create: `render.yaml`, `apps/web/vercel.json`, `DEPLOYMENT.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: a live web URL and a live API URL, verified against each other

- [ ] **Step 1: Write the Render blueprint**

`render.yaml`:

```yaml
services:
  - type: web
    name: internship-api
    runtime: node
    plan: starter          # NOT free — free instances spin down and cold-start ~50s
    region: singapore      # closest to an Indian audience
    rootDir: .
    buildCommand: npm install && npm run build:shared && npm run build --workspace @internship/api
    startCommand: node apps/api/dist/index.js
    healthCheckPath: /health
    envVars:
      - key: NODE_VERSION
        value: "24"
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: WEB_ORIGIN
        sync: false
```

`plan: starter` is deliberate and is recorded in the spec as non-optional. On
the free plan the instance sleeps after 15 minutes and the next request takes
roughly 50 seconds — on the payment button in Phase 2, that is a lost sale.

`sync: false` means Render will not sync the value from the blueprint; you set
each secret by hand in the dashboard. Secrets never enter the repo.

- [ ] **Step 2: Configure Vercel**

`apps/web/vercel.json`:

```json
{
  "buildCommand": "cd ../.. && npm install && npm run build:shared && npm run build --workspace @internship/web",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

In the Vercel dashboard: import the repo, set **Root Directory** to `apps/web`, and add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
| `NEXT_PUBLIC_API_URL` | the Render URL, e.g. `https://internship-api.onrender.com` |

- [ ] **Step 3: Deploy and cross-wire**

1. Deploy to Render first. Note the URL.
2. Set `NEXT_PUBLIC_API_URL` in Vercel to that URL, then deploy the web app.
3. Set `WEB_ORIGIN` in Render to the Vercel URL. This is required — CORS rejects the browser otherwise.
4. Redeploy the API so the new `WEB_ORIGIN` takes effect.

In Supabase → Authentication → URL Configuration, set **Site URL** to the
Vercel URL and add `https://<vercel-url>/auth/callback` to the redirect
allow-list. Email confirmation links break without this.

- [ ] **Step 4: Verify in production**

```bash
curl -s https://<render-url>/health
```

Expected: `{"status":"ok"}`

Then, in a browser on the live Vercel URL, repeat all six checks from Task 8
Step 6. They must all pass against production, not localhost.

- [ ] **Step 5: Write `DEPLOYMENT.md`**

```markdown
# Deployment

| Piece | Host | Notes |
|---|---|---|
| `apps/web` | Vercel | Root Directory = `apps/web` |
| `apps/api` | Render | **Starter plan or above** — the free plan cold-starts ~50s |
| Database | Supabase | Migrations via `supabase db push` |

## Environment variables

**Vercel** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_API_URL`

**Render** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_ORIGIN`

`SUPABASE_SERVICE_ROLE_KEY` bypasses all row-level security. It belongs on
Render only. It must never appear in `apps/web`, in any `NEXT_PUBLIC_` var,
or in the repository.

## Supabase auth configuration

Site URL = the Vercel URL. Redirect allow-list must include
`https://<vercel-url>/auth/callback`.

## Order of operations on first deploy

1. Deploy the API, note its URL
2. Set `NEXT_PUBLIC_API_URL` on Vercel, deploy the web app
3. Set `WEB_ORIGIN` on Render to the Vercel URL, redeploy the API

## Keeping the API warm

Even on the starter plan, add an uptime monitor hitting `/health` every
5 minutes. It surfaces outages before a student does.
```

- [ ] **Step 6: Commit**

```bash
git add render.yaml apps/web/vercel.json DEPLOYMENT.md README.md
git commit -m "chore: add Render and Vercel deployment configuration"
```

---

## Phase 1 Done When

- [ ] `npm test` passes from the repo root (16+ tests)
- [ ] `npm run typecheck` passes with no errors
- [ ] All 10 tables exist in Supabase with RLS enabled
- [ ] Creating an auth user auto-creates a `profiles` row with `role = 'student'`
- [ ] A student can sign up, sign in, and sign out **on the live Vercel URL**
- [ ] The live dashboard displays a profile fetched through the live Render API
- [ ] `/dashboard` redirects to `/sign-in` when signed out
- [ ] `SUPABASE_SERVICE_ROLE_KEY` appears nowhere in `apps/web` or in git history

## Deferred to Phase 2

Landing page design, track catalogue, Razorpay, lesson player, submissions,
certificates, admin panel. Phase 1 is the skeleton these hang off.
