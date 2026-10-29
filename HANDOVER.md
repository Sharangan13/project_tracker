# Handover — Module Task Tracker v2

## What changed
Your v1 app (Next.js 14 + Tailwind + browser-side Supabase) was **updated, not rebuilt**: the board, cards, drag-and-drop, "Mod N" range creation, progress bar, modals, history list and styling were kept and reworked.

| Before | Now |
|---|---|
| Browser talks to Supabase directly (Supabase Auth + RLS), one admin | Server API (Vercel serverless) → Supabase PostgreSQL via `DATABASE_URL` |
| Admin + members, statuses New/In progress/Done | Accounts, teams, **leader/member** roles per team, statuses **Pending/Completed** (Unassigned = no assignee) |
| Free-text history search | Activity log with filters: team, user, action type, date (+ search) |
| `@supabase/supabase-js`, 3 env vars | `pg`; `.env.example` with `NODE_ENV` and `DATABASE_URL` |

Removed: `lib/supabase*.js`, `app/api/users`, `components/Tracker.jsx` (now `components/TeamWorkspace.jsx`).

## Deliverables
`module-task-tracker.zip` (frontend + backend, one Next.js project) · `supabase-schema.sql` (same as `supabase/schema.sql`) · `.env.example` · `README.md` · this file.

## To go live
1. Supabase SQL Editor → run `supabase-schema.sql`.
2. Vercel → add `DATABASE_URL` using the **Transaction pooler** string (direct host is IPv6-only and unreachable from Vercel) → deploy.
3. Open the site, **Create account**, create your first team, then follow the README first-run checklist.

## Verification status (honest summary)
The build environment had **no internet and no PostgreSQL**, so:

**Actually run and passing**
- 21 unit tests (`npm test`): password hashing/verification, session token and team-code generation, CSRF origin check, input validation, role permissions (leader vs member vs other users), password-reset rules, last-leader guard, module-range parser, activity filter SQL builder (bound parameters, team scoping, injection attempts rejected).
- Syntax check of every server file; every relative import in the project resolves to a real file.

**Not run — please test**
- `npm install` / `next build` (the JSX components were only checked with a rough bracket/tag balance script and an import/export cross-check, not compiled).
- `schema.sql` and all API SQL against a real PostgreSQL/Supabase database. I reviewed the SQL by hand; a typo is possible.
- Any browser or end-to-end workflow, mobile layout on real devices, and the Vercel deployment.
Expect to possibly fix small issues on first build/run. The README checklist covers the main workflows.

## Decisions to know about
- Custom auth instead of Supabase Auth, because the required env is only `DATABASE_URL`. Sessions are DB-stored hashed tokens (no JWT secret to manage).
- Logins a leader creates are "team-managed": that leader can reset the password while the login belongs to no other team.
- Removing a team-created login that belongs to no other team deletes the login.
- v1 data is not migrated.

## Possible next steps
Email-based password recovery, invitations with consent, a real DB integration test suite, CSP with nonces, audit-log export.
