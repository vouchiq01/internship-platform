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
