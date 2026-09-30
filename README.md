# Internship Platform

A paid internship platform for engineering students. Pick a track, pay,
work through video lessons, build a project, get it reviewed by a human,
and receive a verifiable certificate.

Tracks: Development, QA, AI Engineering, DevOps.

## Documentation

- [Design spec](docs/superpowers/specs/2026-09-30-internship-platform-design.md)
- [Phase 1 plan](docs/superpowers/plans/2026-09-30-phase-1-foundation.md)
- [Deployment](DEPLOYMENT.md)
- [Database](supabase/README.md)

## Layout

    packages/shared   Zod schemas shared by web and api
    apps/api          Express + TypeScript  -> Render
    apps/web          Next.js App Router    -> Vercel
    supabase          SQL migrations

## Getting started

    npm install
    cp .env.example apps/api/.env
    cp .env.example apps/web/.env.local   # keep only the NEXT_PUBLIC_ vars
    npm run build:shared
    npm test

Then, in two terminals:

    npm run dev:api
    npm run dev:web

## Architecture in one rule

The browser talks to Supabase **for authentication only**. Every piece of
domain data goes through the Express API, which holds the `service_role`
key and is the only thing that touches database tables.
