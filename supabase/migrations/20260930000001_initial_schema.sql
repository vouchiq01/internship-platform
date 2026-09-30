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
