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
