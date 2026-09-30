-- ============================================================
-- Replace the placeholder curriculum with real, verified videos
--
-- Every youtube_video_id below was checked against YouTube's oEmbed endpoint
-- and resolved 200 with an embeddable video; durations were read from the
-- watch page, not estimated. Two candidates were dropped during research:
-- one 404'd, and one turned out to be a 6-minute announcement that a course
-- exists rather than the course itself.
--
-- These are third-party videos embedded under YouTube's standard embed terms.
-- creator_name exists so every lesson credits its author on screen. Re-check
-- the ids periodically: creators can delete videos or disable embedding, and
-- a dead embed is a silent failure for a paying student.
-- ============================================================

alter table public.lessons
  add column creator_name text not null default '';

-- Remove the seeded placeholders only. Anything an admin has already added
-- by hand is left alone.
delete from public.lessons where youtube_video_id = 'PLACEHOLDER';

insert into public.lessons
  (track_id, title, description, youtube_video_id, creator_name, duration_minutes, sort_order)
select t.id, l.title, l.description, l.video_id, l.creator, l.minutes, l.sort_order
from public.tracks t
join (values
  -- ---------------- Development ----------------
  ('development', 'How a full-stack application fits together',
   'The shape of the thing before any code: client, server, database, and what talks to what.',
   'Hl7diL7SFw8', 'PedroTech', 27, 0),
  ('development', 'Node.js and Express from the ground up',
   'Routing, middleware, request handling, and serving JSON that another program can consume.',
   'G8uL0lFFoN0', 'freeCodeCamp.org', 148, 1),
  ('development', 'The PERN stack: Postgres, Express, React, Node',
   'Wiring a React frontend to a real Postgres database through an Express API.',
   'ldYcgPKEZC8', 'freeCodeCamp.org', 83, 2),
  ('development', 'What JSON Web Tokens actually are',
   'How token authentication works, what is inside a JWT, and the mistakes that leak accounts.',
   'x5gLL8-M9Fo', 'freeCodeCamp.org', 101, 3),
  ('development', 'Adding authentication to your API',
   'Hashing passwords, issuing tokens, and protecting routes in a Node and Express application.',
   'favjC6EKFgw', 'Dave Gray', 60, 4),
  ('development', 'Capstone: build and ship a real application',
   'A long, complete build. Follow it end to end, then go and build your own from the same parts.',
   'J01rYl9T3BU', 'freeCodeCamp.org', 380, 5),

  -- ---------------- Quality Assurance ----------------
  ('qa', 'Introduction to Playwright',
   'What end-to-end testing is for, from a member of the Playwright team.',
   'lCb9JoZFpHI', 'This Dot Media', 81, 0),
  ('qa', 'Playwright with TypeScript, start to finish',
   'Locators, assertions, fixtures, configuration, and running a suite you can trust.',
   'wawbt1cATsk', 'TestMu AI (LambdaTest)', 341, 1),
  ('qa', 'A complete end-to-end mini project',
   'Automating a real application from scratch, with the practices that keep a suite maintainable.',
   '5wSztvWhx14', 'Automation Step by Step', 40, 2),
  ('qa', 'Advanced Playwright patterns',
   'Page objects, parallelism, CI runs, and what to do about flakiness.',
   'YfRazDhi9Fw', 'Testers Talk', 142, 3),

  -- ---------------- AI Engineering ----------------
  ('ai-engineering', 'RAG fundamentals',
   'Why retrieval exists, what it fixes about a bare language model, and the parts of a pipeline.',
   'ea2W8IogX80', 'freeCodeCamp.org', 97, 0),
  ('ai-engineering', 'Building RAG from scratch',
   'Indexing, retrieval and generation implemented step by step, from a LangChain engineer.',
   'sVcwVQRHIc8', 'freeCodeCamp.org', 153, 1),
  ('ai-engineering', 'A complete RAG crash course',
   'The same ground covered a second way, with LangChain. Repetition here is deliberate.',
   'o126p1QN_RI', 'Krish Naik', 128, 2),
  ('ai-engineering', 'Your first working RAG application',
   'Taking it from notebook to something a person can actually use.',
   'KSItlTAsMsk', 'DataTalksClub', 124, 3),
  ('ai-engineering', 'Running retrieval locally',
   'A long, careful build with no hosted API in the loop — the best way to see what each piece does.',
   'qN_2fnOPY-M', 'Daniel Bourke', 341, 4),
  ('ai-engineering', 'Putting RAG into production',
   'Evaluation, cost and the operational questions that only appear once real users arrive.',
   'vT-DpLvf29Q', 'KodeKloud', 48, 5),

  -- ---------------- DevOps ----------------
  ('devops', 'Docker from first principles',
   'Images, layers, volumes and networking, explained properly rather than as commands to copy.',
   '3c-iBn73dDE', 'TechWorld with Nana', 166, 0),
  ('devops', 'Docker and Kubernetes together',
   'What an orchestrator is for, and when you genuinely need one.',
   'bhBSlnQcq2k', 'Amigoscode', 258, 1),
  ('devops', 'Building a real CI/CD pipeline',
   'GitHub Actions, Docker and a deploy that happens without anyone typing a command.',
   'hbeLqL6sjKA', 'LearnwithDevOpsEngineer', 83, 2),
  ('devops', 'The wider DevOps toolchain',
   'Git, cloud, infrastructure as code and monitoring — how the pieces connect in practice.',
   'Tq0vZU7Hp_M', 'Sangam Mukherjee', 325, 3)
) as l(slug, title, description, video_id, creator, minutes, sort_order) on l.slug = t.slug;
