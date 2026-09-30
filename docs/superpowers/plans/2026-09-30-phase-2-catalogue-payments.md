# Phase 2: Catalogue & Payments — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** A student can browse the four tracks, pay ₹1,999 through Razorpay, and have their enrollment activated by a verified webhook.

**Architecture:** Track catalogue is read-only public API. Payment follows the create-order → checkout → webhook pattern, where **the webhook is the sole authority for granting access**. The browser's success callback is advisory.

**Spec:** [`../specs/2026-09-30-internship-platform-design.md`](../specs/2026-09-30-internship-platform-design.md)

## Global Constraints

Inherits every constraint from the Phase 1 plan, plus:

- **Money is paise, as `bigint`.** `price_inr` is rupees on `tracks`; the Razorpay order amount is `price_inr * 100`.
- **The price is read server-side from `tracks`.** A price in the request body is a price the user can edit.
- **Access is granted by the webhook, never the browser callback.**
- **The webhook route reads the raw body** for HMAC verification, and must be mounted *before* `express.json()`.
- **The webhook is idempotent.** Razorpay retries; `razorpay_order_id` is unique.
- Razorpay **test keys only** during development. Never a live key in this repo.

---

## Task 1: Track and enrollment schemas

**Files:**
- Create: `packages/shared/src/track.ts`, `packages/shared/src/track.test.ts`
- Create: `packages/shared/src/enrollment.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `trackSchema`/`Track`, `trackDetailSchema`/`TrackDetail`, `lessonSummarySchema`/`LessonSummary`, `createEnrollmentSchema`/`CreateEnrollmentInput`, `enrollmentSchema`/`Enrollment`, `createOrderResponseSchema`/`CreateOrderResponse`

- [ ] **Step 1: Write the failing test** covering: a valid track parses; a negative `priceInr` is rejected; `listPriceInr` may be null; `createEnrollmentSchema` rejects a body carrying an `amount` field (price must never come from the client).

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement the schemas.** `Track` carries `id, slug, title, description, priceInr, listPriceInr, durationWeeks, thumbnailUrl, isPublished, sortOrder`. `TrackDetail` extends it with `lessons: LessonSummary[]` and `project: { title, briefMarkdown } | null`. `createEnrollmentSchema` is `{ trackId: string().uuid() }` and nothing else — unknown keys stripped.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

## Task 2: Migration — list price, seed tracks and projects

**Files:**
- Create: `supabase/migrations/20260930000002_seed_catalogue.sql`

- [ ] **Step 1: Add the `list_price_inr` column** to `tracks`, nullable int, with a check that it is greater than `price_inr` when present. The anchor price is display-only and never used to compute a charge.

- [ ] **Step 2: Seed the four tracks** — Development, Quality Assurance, AI Engineering, DevOps — at `price_inr = 1999`, `list_price_inr = 6000`, `is_published = true`, with slugs matching `apps/web/src/lib/tracks.ts`.

- [ ] **Step 3: Seed one project row per track** with a real brief.

- [ ] **Step 4: Seed lessons** — a representative set per track with real YouTube video IDs left as placeholders the admin replaces. Mark clearly in a comment that these are placeholders.

- [ ] **Step 5: Commit.** Do not push; no Supabase project yet.

---

## Task 3: Track catalogue API

**Files:**
- Create: `apps/api/src/routes/tracks.ts`, `apps/api/src/routes/tracks.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Produces: `createTracksRouter(deps: TracksDeps): Router` mounting `GET /api/tracks` and `GET /api/tracks/:slug`; `TracksDeps = { listTracks(): Promise<Track[]>; getTrackBySlug(slug): Promise<TrackDetail | null> }`; `createTracksDeps(supabase): TracksDeps`

- [ ] **Step 1: Write the failing test** — list returns only published tracks in `sortOrder`; detail returns lessons ordered by `sortOrder`; an unknown slug is 404; an unpublished track is 404 even by direct slug.

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement.** Row-to-camelCase mapping lives in this file, matching the `rowToProfile` pattern from Phase 1. No auth — this is the public catalogue.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

## Task 4: Razorpay order creation

**Files:**
- Create: `apps/api/src/razorpay.ts`, `apps/api/src/razorpay.test.ts`
- Modify: `apps/api/src/config.ts`

**Interfaces:**
- Produces: `verifyWebhookSignature(rawBody: Buffer|string, signature: string, secret: string): boolean`; `verifyPaymentSignature(orderId, paymentId, signature, secret): boolean`; `RazorpayClient` interface with `createOrder({ amountPaise, currency, receipt, notes }): Promise<{ id: string }>`; `createRazorpayClient(config)` calling the real API.

- [ ] **Step 1: Write the failing test** for signature verification using known HMAC-SHA256 fixtures: a correct signature passes; a tampered body fails; a wrong secret fails; an empty signature fails; a signature of the wrong length fails without throwing.

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement using `node:crypto`.** Compare with `crypto.timingSafeEqual` over equal-length buffers, guarding the length check first so it cannot throw. A plain `===` here is a timing oracle.

- [ ] **Step 4: Add Razorpay config keys** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — to the env schema.

- [ ] **Step 5: Run tests, confirm pass. Commit.**

---

## Task 5: Enrollment creation endpoint

**Files:**
- Create: `apps/api/src/routes/enrollments.ts`, `apps/api/src/routes/enrollments.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Produces: `createEnrollmentsRouter(deps): Router` mounting `POST /api/enrollments` and `GET /api/enrollments`; `EnrollmentsDeps = { auth; getTrackById(id); findEnrollment(userId, trackId); createPendingEnrollment(...); listEnrollments(userId) }`

- [ ] **Step 1: Write the failing test.** The cases that matter:
  - unauthenticated → 401
  - unknown track → 404
  - unpublished track → 404
  - **price comes from the track, not the body** — send `{ trackId, priceInr: 1 }` and assert the Razorpay order was created for 199900 paise
  - already `active` on that track → 409, no new order
  - existing `pending_payment` → returns the *existing* order rather than creating a duplicate
  - happy path → 201 with `{ orderId, amountPaise, currency, keyId }`

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement.** Read price from the track row, compute `amountPaise = priceInr * 100`, create the Razorpay order, then insert `payments` and `enrollments` rows. Return the public `keyId` so the browser can open Checkout; never return the secret.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

## Task 6: Razorpay webhook

**Files:**
- Create: `apps/api/src/routes/webhooks.ts`, `apps/api/src/routes/webhooks.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Produces: `createWebhookRouter(deps): Router` mounting `POST /api/webhooks/razorpay`; `WebhookDeps = { webhookSecret; findPaymentByOrderId; markPaid; activateEnrollment; logAudit }`

- [ ] **Step 1: Write the failing test.** This is the highest-stakes test in the codebase:
  - missing signature header → 400, nothing activated
  - invalid signature → 400, nothing activated
  - valid signature, unknown order → 404, nothing activated
  - **amount mismatch** — webhook says 100 paise but the payment row says 199900 → 400, **enrollment NOT activated**
  - valid `payment.captured` → payment marked paid, enrollment activated
  - **delivered twice → enrollment activated exactly once** (idempotency)
  - `payment.failed` → payment marked failed, enrollment stays `pending_payment`
  - the route is mounted with a raw body parser, so `express.json()` does not consume it first

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement.** Mount with `express.raw({ type: 'application/json' })` **before** the global `express.json()`. Verify the signature against the raw buffer, then parse. Reconcile the amount against the stored `payments.amount_paise`. Return 200 on an already-processed order so Razorpay stops retrying.

- [ ] **Step 4: Run tests, confirm pass. Commit.**

---

## Task 7: Track detail page

**Files:**
- Create: `apps/web/src/app/tracks/[slug]/page.tsx`, `apps/web/src/app/tracks/[slug]/not-found.tsx`
- Create: `apps/web/src/components/track/curriculum.tsx`, `apps/web/src/components/track/enrol-button.tsx`
- Modify: `apps/web/src/lib/api.ts` — add an unauthenticated `publicFetch`

**Interfaces:**
- Consumes: `GET /api/tracks/:slug`, `POST /api/enrollments`
- Produces: the page at `/tracks/{slug}` that the landing page already links to

- [ ] **Step 1: Add `publicFetch`** to `lib/api.ts` — same shape as `apiFetch` but without the Supabase session lookup, for public catalogue reads.

- [ ] **Step 2: Build the page** in the established dossier language: track accent as the index colour, curriculum as a numbered document list, the project brief, and the ₹1,999 / ₹6,000 price block.

- [ ] **Step 3: Build `EnrolButton`** — a client component that POSTs to `/api/enrollments`, loads the Razorpay Checkout script, opens it with the returned `orderId` and `keyId`, and on dismissal or success routes to `/dashboard` with a "we are confirming your payment" state. It must **not** grant access itself.

- [ ] **Step 4: Verify** the build passes and the four track links from the landing page all resolve.

- [ ] **Step 5: Commit.**

---

## Phase 2 Done When

- [ ] All Phase 1 tests still pass, plus the new suites
- [ ] `npm run typecheck` clean, `npm audit` clean
- [ ] Every track card on the landing page resolves to a real page
- [ ] A tampered price in the request body cannot change what is charged — proven by test
- [ ] A replayed webhook activates an enrollment exactly once — proven by test
- [ ] An amount mismatch between webhook and stored payment refuses activation — proven by test

## Deferred

Live Razorpay integration testing needs a Razorpay test account and a
Supabase project. Until then the HTTP client is exercised against a fake and
only the signature/reconciliation logic is proven.
