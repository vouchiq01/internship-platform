-- ============================================================
-- Catalogue: list price column, plus the four launch tracks
-- ============================================================

-- Display-only anchor price. Never used to compute a charge — the Razorpay
-- order amount is always derived from price_inr.
alter table public.tracks
  add column list_price_inr int
  check (list_price_inr is null or list_price_inr > price_inr);

-- ---------- tracks ----------
insert into public.tracks
  (slug, title, description, price_inr, list_price_inr, duration_weeks, is_published, sort_order)
values
  ('development', 'Development',
   'Ship a full-stack application with authentication, a real database and a deploy pipeline.',
   1999, 6000, 8, true, 0),
  ('qa', 'Quality Assurance',
   'Build an end-to-end automation suite that catches real regressions, not just green ticks.',
   1999, 6000, 8, true, 1),
  ('ai-engineering', 'AI Engineering',
   'Take a model from prompt to production — retrieval, evaluation, and cost you can defend.',
   1999, 6000, 10, true, 2),
  ('devops', 'DevOps',
   'Containerise, automate and observe a service until a deploy stops being frightening.',
   1999, 6000, 8, true, 3);

-- ---------- projects (one per track) ----------
insert into public.projects (track_id, title, brief_markdown, requirements)
select
  t.id,
  p.title,
  p.brief,
  p.requirements
from public.tracks t
join (values
  ('development',
   'Full-stack web application',
   E'Build and deploy a working web application that a stranger can sign up for and use.\n\nIt must persist real data, not mock it. It must be deployed at a public URL. The README must explain how to run it locally in under five minutes.',
   E'- Authentication with sign up, sign in and sign out\n- At least two related database tables with a real relationship\n- Create, read, update and delete on the primary resource\n- Deployed and reachable at a public URL\n- README with setup steps and a screenshot'),
  ('qa',
   'End-to-end automation framework',
   E'Write an automation suite against a real web application — yours or a public one.\n\nThe suite must catch a regression that a human would plausibly ship. Flaky tests that always pass are worth nothing here.',
   E'- Page object or equivalent abstraction, not selectors scattered through specs\n- At least eight meaningful end-to-end specs\n- One negative-path test per critical flow\n- Runs headless in CI with a reproducible command\n- A short written note on what you deliberately chose not to automate'),
  ('ai-engineering',
   'Retrieval-augmented application',
   E'Build an application that answers questions over a document set you supply.\n\nIt must handle the case where the answer is not in the documents. Confidently inventing an answer is a fail.',
   E'- Document ingestion and chunking you can justify\n- Vector search with a stated embedding model\n- An honest "I do not know" path when retrieval finds nothing relevant\n- An evaluation set of at least twenty questions with expected answers\n- A written note on cost per query'),
  ('devops',
   'CI/CD pipeline with monitoring',
   E'Take an application and make deploying it boring.\n\nA push to main should reach production without anyone typing a command, and you should find out it broke before a user tells you.',
   E'- Containerised application with a working Dockerfile\n- Pipeline running tests, build and deploy on push\n- Infrastructure defined as code, not clicked in a console\n- Health checks plus at least one alert that actually fires\n- A runbook for the most likely failure')
) as p(slug, title, brief, requirements) on p.slug = t.slug;

-- ---------- lessons ----------
-- NOTE: youtube_video_id values below are PLACEHOLDERS. Replace every one of
-- them from the admin panel before publishing a track to real students.
insert into public.lessons
  (track_id, title, description, youtube_video_id, duration_minutes, sort_order)
select t.id, l.title, l.description, 'PLACEHOLDER', l.minutes, l.sort_order
from public.tracks t
join (values
  ('development', 'How the web actually works',        'Requests, responses, and what a server really is.',        18, 0),
  ('development', 'Setting up your environment',       'Node, a package manager, and an editor that helps you.',   22, 1),
  ('development', 'Your first API endpoint',           'Routing, handlers, and returning JSON.',                   26, 2),
  ('development', 'Databases and relationships',       'Tables, foreign keys, and why normalisation matters.',     31, 3),
  ('development', 'Authentication without tears',      'Sessions, tokens, and the mistakes that leak accounts.',   28, 4),
  ('development', 'Deploying to production',           'Environments, secrets, and your first real deploy.',       24, 5),

  ('qa',          'What testing is actually for',      'Confidence, not coverage numbers.',                        16, 0),
  ('qa',          'Writing your first automated test', 'Selectors, assertions, and the run loop.',                 21, 1),
  ('qa',          'The page object pattern',           'Why selectors in specs become unmaintainable.',            25, 2),
  ('qa',          'Handling flakiness',                'Waits, retries, and why sleep() is a trap.',               27, 3),
  ('qa',          'Testing in CI',                     'Headless runs, artefacts, and reading a failure.',         23, 4),

  ('ai-engineering', 'What a language model is doing', 'Tokens, context, and why it makes things up.',             20, 0),
  ('ai-engineering', 'Prompting as engineering',       'Structure, examples, and measuring a change.',             24, 1),
  ('ai-engineering', 'Embeddings and vector search',   'Turning meaning into numbers you can search.',             29, 2),
  ('ai-engineering', 'Building a retrieval pipeline',  'Chunking, indexing, and retrieval you can debug.',          33, 3),
  ('ai-engineering', 'Evaluation you can trust',       'Test sets, regressions, and avoiding self-deception.',     28, 4),
  ('ai-engineering', 'Cost and latency in production', 'Caching, model choice, and defending your bill.',          22, 5),

  ('devops',      'What DevOps actually means',        'Beyond the job title.',                                    15, 0),
  ('devops',      'Containers from first principles',  'Images, layers, and why your build is slow.',              27, 1),
  ('devops',      'Building a pipeline',               'Stages, caching, and failing fast.',                       26, 2),
  ('devops',      'Infrastructure as code',            'Declaring what you want instead of clicking.',             30, 3),
  ('devops',      'Monitoring and alerting',           'Signals worth waking up for.',                             25, 4)
) as l(slug, title, description, minutes, sort_order) on l.slug = t.slug;
