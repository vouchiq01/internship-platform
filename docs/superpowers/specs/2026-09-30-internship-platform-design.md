# Internship Platform — Design Spec

**Date:** 2026-09-30
**Status:** Awaiting review

## 1. Product

A paid internship platform for engineering students. A student picks a track,
pays upfront, works through a sequence of video lessons, builds one project,
submits it for human review, and — once an admin approves — receives a
verifiable certificate.

Four tracks at launch: **Development, QA, AI Engineering, DevOps**.

Single-tenant. One brand, one admin, one set of tracks. There is no
organisation or tenant concept anywhere in the schema.

### What we are actually selling

The certificate, not the videos. This matters for two decisions recorded
below: we accept that YouTube links will leak, and we invest in making the
certificate independently verifiable.

### Non-goals for V1

- Multi-tenancy (colleges running their own programs)
- Live mentorship, cohorts, or scheduled sessions
- Discussion forums or peer review
- Mobile apps
- Refunds handled in-app (handle manually in the Razorpay dashboard)
- More than one project per track

## 2. Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Payment gate | Pay upfront to enrol | One `enrollment` row is the single source of truth for access. No per-lesson entitlement logic. |
| Verification | Admin reviews manually | The certificate has to mean something. Auto-approval would make the product worthless. |
| Tenancy | Single-tenant | No `org_id`. Revisit only if colleges start asking. |
| Progression | Sequential, "Mark complete" button | Honour system is acceptable because the project review is the real gate. Avoids a fragile YouTube iframe API dependency. |
| Certificate | PDF + public `/verify/{number}` page | A recruiter must be able to check it without logging in. That is what makes it worth paying for. |
| Architecture | Vercel + Render + Supabase | User's choice. See §3 for the consequence we are accepting. |

### Accepted risks

**YouTube links leak.** Unlisted YouTube videos are just URLs. A paying student
can share them. There is no mitigation within YouTube — solving it requires
signed-URL video hosting (Mux, Cloudflare Stream). We ship with YouTube anyway
because the certificate, not the video, is the paid good. Revisit if piracy
measurably hurts conversion.

**Render cold starts.** Render's free tier spins down after 15 minutes idle;
the next request takes roughly 50 seconds. On a payment button that reads as a
broken site. **Mitigation: paid Render instance from day one, plus an uptime
ping against `/health`.** This is non-optional, not a later optimisation.

## 3. Architecture

```
┌─────────────────┐   HTTPS + JWT  ┌──────────────────┐
│  Next.js 15     │───────────────▶│  Express + TS    │
│  App Router     │                │  on Render       │
│  on Vercel      │◀───────────────│  (paid instance) │
└────────┬────────┘                └────────┬─────────┘
         │                                  │ service_role key
         │ Supabase Auth ONLY               ▼
         │                         ┌──────────────────┐
         └────────────────────────▶│   Supabase       │
                                   │  Postgres        │
                                   │  Auth · Storage  │
                                   └──────────────────┘
                                            ▲
                         Razorpay ──────────┘ webhook → Render
```

### The access rule

The browser talks to Supabase **only for authentication**. Every piece of
domain data — tracks, progress, submissions, certificates — is fetched and
mutated through the Render API.

Consequence: all business rules live in Express, in one place. They are not
split between application code and Postgres RLS policies. RLS is still enabled
on every table with deny-all policies as defence-in-depth, but because only
`service_role` ever connects, no policy is load-bearing.

### Auth chain

1. Supabase Auth issues a JWT (email/password + Google OAuth).
2. Next.js holds the session via `@supabase/ssr`.
3. Each API call sends `Authorization: Bearer <jwt>`.
4. Express middleware verifies the JWT against the Supabase JWT secret,
   then loads `profiles.role` to authorise.

Admin is a role on `profiles`, not a separate auth system. The first admin is
promoted by hand in the Supabase table editor.

### Repository layout

Monorepo, so TypeScript types are shared between frontend and backend rather
than duplicated and drifting.

```
internship-platform/
├── apps/
│   ├── web/          Next.js 15 → Vercel
│   └── api/          Express + TS → Render
├── packages/
│   └── shared/       Zod schemas + inferred types, used by both
├── supabase/
│   └── migrations/   SQL migrations, version controlled
└── docs/
```

Zod schemas in `packages/shared` are the contract: the API validates requests
against them, and the frontend infers its types from the same source.

## 4. Data model

Ten tables.

### `profiles`
Extends `auth.users`. `id` (uuid, FK to auth.users), `full_name`, `email`,
`phone`, `college`, `graduation_year`, `role` (`student` | `admin`),
`created_at`.

### `tracks`
`id`, `slug`, `title`, `description`, `price_inr`, `duration_weeks`,
`thumbnail_url`, `is_published`, `sort_order`, `created_at`.

### `lessons`
`id`, `track_id`, `title`, `description`, `youtube_video_id`,
`duration_minutes`, `sort_order`, `created_at`.
Unique on `(track_id, sort_order)`.

Store the YouTube **video ID**, not the full URL. URLs come in several formats
and normalising once on write is cheaper than parsing on every read.

### `enrollments`
`id`, `user_id`, `track_id`, `status` (`pending_payment` | `active` |
`completed`), `enrolled_at`, `completed_at`.
Unique on `(user_id, track_id)`.

### `lesson_progress`
`id`, `enrollment_id`, `lesson_id`, `completed_at`.
Unique on `(enrollment_id, lesson_id)`.

### `payments`
`id`, `user_id`, `track_id`, `razorpay_order_id` (**unique**),
`razorpay_payment_id`, `razorpay_signature`, `amount_paise`, `currency`,
`status` (`created` | `paid` | `failed` | `refunded`), `created_at`, `paid_at`.

`razorpay_order_id` being unique is the idempotency key for webhook delivery.

Amounts are stored in **paise as integers**. Never floats for money.

### `projects`
`id`, `track_id`, `title`, `brief_markdown`, `requirements`, `created_at`.
One per track in V1.

### `submissions`
`id`, `enrollment_id`, `project_id`, `github_url`, `live_url` (nullable),
`notes`, `file_url` (nullable), `status` (`pending` | `approved` |
`rejected`), `attempt_number`, `reviewer_id`, `review_feedback`,
`submitted_at`, `reviewed_at`.

### `certificates`
`id`, `enrollment_id` (**unique**), `certificate_number` (**unique**),
`student_name_snapshot`, `track_title_snapshot`, `issued_at`, `pdf_url`,
`revoked_at` (nullable).

The snapshot columns are deliberate. A certificate is a document someone has
already attached to a job application. If the track were joined rather than
snapshotted, renaming "AI Engineering" to "AI/ML Engineering" would silently
rewrite the text of every certificate ever issued. Snapshots make issued
credentials immutable.

`certificate_number` format: `INTX-2026-DEV-00042` — prefix, year, track code,
zero-padded sequence within track.

### `audit_log`
`id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` (jsonb),
`created_at`.

Records approvals, rejections, and certificate issuance/revocation. Cheap to
add now, and the only thing that will settle a dispute later.

## 5. Critical flows

### 5.1 Payment

```
Student clicks Enrol
  → POST /api/enrollments { track_id }
      · read price from tracks table — NEVER from the request body
      · create Razorpay order
      · insert payments (status: created)
      · insert enrollment (status: pending_payment)
      · return razorpay_order_id
  → browser opens Razorpay Checkout
  → student pays
  ├─ browser success callback → show "processing…"   [ADVISORY ONLY]
  └─ Razorpay webhook → POST /api/webhooks/razorpay
        · verify HMAC signature; reject on mismatch
        · verify amount_paise matches the track price
        · payments → paid, enrollment → active
```

Two rules that are not negotiable:

1. **Access is granted by the webhook, never by the browser callback.** The
   callback is a UX affordance. Anyone with devtools can fake it.
2. **The price is read server-side from `tracks`.** A price in the request body
   is a price the user can edit.

The webhook must be idempotent — Razorpay retries. The unique constraint on
`razorpay_order_id` plus an upsert handles this.

The webhook route must read the **raw request body** for signature
verification. Mount it before any JSON body-parsing middleware.

### 5.2 Certificate issuance

```
All lessons marked complete  ─┐
                              ├──▶ Project unlocks
Enrollment status = active   ─┘
        ↓
Student submits GitHub URL (+ optional live URL, notes)
        ↓
Admin review queue
   ├─ Reject + written feedback → student resubmits (attempt_number + 1)
   └─ Approve
         ↓
   Generate PDF → upload to Supabase Storage → insert certificates row
   enrollment → completed, write audit_log
         ↓
   Public page: /verify/INTX-2026-DEV-00042
```

Both gates must pass. Checked server-side on submission, not just hidden in
the UI.

PDF generation runs synchronously inside the approve request. On a
long-running Render instance this is fine, and it is the clearest place where
the chosen architecture pays off over serverless.

Generation uses `pdf-lib` or `@react-pdf/renderer` — pure JS, no headless
Chromium, no system dependencies on the Render image.

### 5.3 Public verification

`GET /verify/:certificate_number` — no authentication. Returns student name,
track, issue date, and status. Revoked certificates display as revoked rather
than 404, so a recruiter sees the truth rather than an ambiguous error.

Rate-limited to prevent enumeration of the certificate space.

## 6. API surface

### Public
- `GET /health`
- `GET /api/tracks`
- `GET /api/tracks/:slug`
- `GET /api/verify/:certificate_number`

### Student (JWT required)
- `GET /api/me`
- `PATCH /api/me`
- `POST /api/enrollments` → creates Razorpay order
- `GET /api/enrollments`
- `GET /api/enrollments/:id` → track, lessons, progress, submission state
- `POST /api/lessons/:id/complete`
- `POST /api/submissions`
- `GET /api/certificates/:id/download`

### Webhook
- `POST /api/webhooks/razorpay` — raw body, HMAC verified

### Admin (role = admin)
- `GET|POST|PATCH|DELETE /api/admin/tracks`
- `GET|POST|PATCH|DELETE /api/admin/lessons`
- `PATCH /api/admin/projects/:id`
- `GET /api/admin/submissions?status=pending`
- `POST /api/admin/submissions/:id/review` — `{ decision, feedback }`
- `GET /api/admin/students`
- `GET /api/admin/students/:id`
- `GET /api/admin/reports/summary`
- `POST /api/admin/certificates/:id/revoke`

## 7. Screens

### Public
- **Landing** — what the internship is, the four tracks, how it works,
  certificate sample, FAQ
- **Track detail** — curriculum outline, project brief preview, price,
  enrol CTA
- **Verify** — `/verify/{number}`, clean and screenshot-worthy
- **Sign in / Sign up**

### Student
- **Dashboard** — enrolled tracks, progress rings, next action
- **Lesson player** — YouTube embed, lesson list rail with lock states,
  "Mark as complete"
- **Project** — brief, submission form, status, reviewer feedback on rejection
- **Certificate** — preview, download, copyable verify link

### Admin
- **Review queue** — pending submissions, one-click open of the GitHub link,
  approve/reject with feedback. The screen the admin lives in.
- **Tracks & lessons** — CRUD, drag to reorder
- **Students** — searchable list, detail view with progress, payment, and
  submission history
- **Reports** — four KPI tiles (revenue, active enrolments, completion rate,
  pending reviews) and two charts (enrolments over time, enrolments by track).
  Deliberately thin.

## 8. Visual direction

Audience is Indian engineering students, roughly 19–22, deciding whether this
is credible enough to pay for. The design has to read as *premium and serious*
without reading as *corporate and dull*.

- **Dark-first.** Deep slate base, not pure black. Light theme supported.
- **One accent per track** for wayfinding — Dev indigo, QA emerald,
  AI violet, DevOps amber. Colour carries meaning; it is not decoration.
- **Confident typography.** Large, tight display headings against generous
  body spacing. A display face with actual character for headings, a clean
  neutral sans for UI.
- **Restraint on effects.** No purple-gradient-SaaS-template look, no
  glassmorphism, no animated blobs. Elevation through subtle borders and
  shadow, not glow.
- **Progress is the emotional core.** Rings, streaks, and the unlock moment
  should feel earned. This is the thing that keeps students coming back.

Stack: Tailwind CSS + shadcn/ui, Recharts for the two admin charts.
Accessibility: WCAG AA contrast, full keyboard navigation, visible focus
rings.

The `frontend-design` skill runs at implementation time to take this from
direction to concrete design.

## 9. Testing

The author has deep Playwright experience, so E2E carries more weight here
than it would on most projects.

- **Unit (Vitest, backend).** Razorpay signature verification, certificate
  number generation, the enrollment and submission state machines,
  price-tampering rejection.
- **Integration (Vitest + a test Supabase project).** API routes against a
  real database. Webhook idempotency — deliver the same webhook twice and
  assert one enrollment.
- **E2E (Playwright).** One critical path end to end: sign up → enrol → pay
  with Razorpay **test mode** → complete all lessons → submit project →
  admin approves → certificate issued → public verify page resolves.

Payment tests use Razorpay test keys and their published test cards only.

## 10. Build order

Each phase ends with something deployed and verifiable.

| Phase | Delivers | Done when |
|---|---|---|
| 1. Foundation | Monorepo, Supabase schema + migrations, auth, both apps deployed as skeletons | Sign up, sign in, and see an empty dashboard in production |
| 2. Catalogue & payment | Landing, track pages, Razorpay, webhook, enrollment activation | A test-mode payment activates a real enrollment |
| 3. Learning | Lesson player, sequential unlock, progress tracking | A student can complete a whole track |
| 4. Submission & review | Submission form, admin review queue, reject/resubmit loop | An admin can approve a submission |
| 5. Certificates | PDF generation, storage, public verify page | A recruiter can verify a certificate from a URL |
| 6. Admin polish | Track/lesson CRUD, student list, reports | The admin never needs the Supabase table editor |

Phases 1 and 2 are the risky ones. Everything after is comparatively routine.

## 11. Environment

**Vercel (web):** `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_RAZORPAY_KEY_ID`

**Render (api):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `WEB_ORIGIN`, `PORT`

No secret is ever exposed under a `NEXT_PUBLIC_` prefix. The Razorpay
**key ID** is public by design; the **key secret** and **webhook secret**
live only on Render.

## 12. Open items

- Pricing per track — not needed until Phase 2
- Transactional email provider (Resend assumed) for payment receipt,
  review outcome, certificate issued
- Domain name
- Certificate PDF visual design — treated as a design task in Phase 5
- Terms of service and refund policy, required by Razorpay at onboarding
