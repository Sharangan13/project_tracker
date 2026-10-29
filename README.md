# Module Task Tracker v2 (Next.js + Tailwind + Supabase PostgreSQL)

Personal accounts, teams with leaders and members, task tracking, and a filterable activity history.
Runs as Vercel serverless functions (Next.js route handlers) and talks to Supabase **PostgreSQL** over `DATABASE_URL`.

## What it does

| Area | Details |
|---|---|
| **Sign-in** | Three tabs: **Login to My Account** (username + password), **Login to a Team** (team code + username + password), **Create account**. |
| **Teams** | Any account can create a team and becomes its **leader**. A user can belong to many teams with a different role in each. |
| **Leaders** | Create tasks (e.g. `1 to 10`), assign/reassign, edit, delete, and monitor progress. Add members by creating a login (username + password) or by adding an existing username; change roles; disable/restore access; reset passwords of logins the team created; regenerate the team code; rename or delete the team. |
| **Members** | See the whole board; mark **their own** tasks Pending/Completed and edit notes on them. |
| **Activity** | Every team/member change, task create/edit/delete, assignment and status change is recorded. Filter by **team, user, action type, date range** (plus text search). |
| **Account page** | Lists all your teams, creates teams, shows cross-team activity, changes your password. |

Roles are enforced **on the server** for every request (not just hidden in the UI).

## 1. Database (Supabase)
1. Create a project at supabase.com.
2. **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, **Run**. It is safe to re-run.
3. Get your connection string: **Project Settings → Database → Connection string**. Keep it private.

The script creates `users, teams, team_memberships, team_tasks, activity_logs, user_sessions, login_attempts`, indexes and triggers, and turns on Row Level Security with no policies so the tables are unreachable through Supabase's public API/anon key. The app does **not** use Supabase Auth or the anon/service keys any more.

> v1 tables (`members, tasks, history, profiles`) are not touched and are not migrated. See "Upgrading from v1".

## 2. Run locally
```bash
cp .env.example .env.local     # then edit DATABASE_URL (never commit this file)
npm install
npm run dev                    # http://localhost:3000
```
Open the app → **Create account** → create a team → **Team → Add member**.

`.env.example` contains `NODE_ENV` and `DATABASE_URL` only.
Special characters in your DB password must be URL-encoded.

## 3. Deploy to Vercel
1. Push the project to Git and import it in Vercel (framework: Next.js, nothing else to configure).
2. Add the environment variable **`DATABASE_URL`**. Do not set `NODE_ENV` (Vercel does).
3. **Use the Supabase pooler string on Vercel.** The direct host `db.<ref>.supabase.co:5432` is IPv6-only and Vercel can't reach it. In Supabase click **Connect → Transaction pooler** and use that URL (port 6543, user `postgres.<ref>`). The code works with transaction pooling.
4. Deploy. Pick the Vercel function region closest to your Supabase region for speed.

## Security design
- **Passwords**: scrypt (N=32768, r=8, p=3) with per-password salt, Node built-in crypto (no native modules). Unknown usernames cost the same time as known ones.
- **Sessions**: random 256-bit token in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie; only a SHA-256 hash is stored in the database; 7-day expiry; password change/reset signs out other sessions.
- **CSRF**: `Origin`/`Sec-Fetch-Site` check on every state-changing request, JSON-only bodies, SameSite cookies.
- **Brute force**: failed logins are counted in the database (per username and per IP), so limits hold across serverless instances.
- **Authorization**: each API call checks active membership and role in the database. Team-login sessions are pinned to one team. Non-members get `404` (team IDs can't be probed). DB triggers also stop assigning tasks to non-members.
- **Leader limits**: a leader can reset passwords only for logins their team created, and only while that login belongs to no other team. A team can never be left without an active leader.
- **SQL**: all queries are parameterised; filter values are bound parameters.
- **Secrets**: nothing is hard-coded; the DB password only exists in `DATABASE_URL`.
- **Headers**: nosniff, frame denial, HSTS, referrer and permissions policies, base CSP directives.

## Layout
```
app/                 pages: / (sign-in), /account, /team/[teamId]
app/api/             auth/*, teams/*, teams/[id]/members|tasks, activity
components/          AuthScreen, AccountHome, TeamWorkspace, ActivityPanel, ui
lib/server/          db, session, security (hashing), permissions, validation, activity query
lib/shared.js        code shared by browser and server (module range parser, action labels)
supabase/schema.sql  complete database script
test/                unit tests for the pure logic
```

## Tests
```bash
npm test      # Node 22+; unit tests for hashing, validation, permissions, CSRF check, filter-query builder
```
These cover the pure logic only. There are **no automated database or browser tests**; use the checklist below after deploying.

## First-run checklist (recommended)
1. Create two accounts (A, B) in two browsers. A creates a team.
2. A: Team → Add member → *Create new login* (member C). Sign in as C via **Login to a Team** with the team code.
3. A: create modules `1 to 5`, assign some to C. C can complete/reopen own tasks, cannot see Edit/assign/delete, and a direct API call to another task returns 403.
4. A: Add existing user `B`; B signs in via **Login to My Account** and sees the team; B creates a second team (B is leader there only).
5. Activity: filter by team, user, action type and dates; check every step above appears.
6. A disables C: C's team session stops working and C's tasks return to Unassigned.
7. Try to demote/remove the only leader: it must be refused.

## Upgrading from v1
v1 used Supabase Auth plus browser-side RLS. v2 replaces that with the server API above. Run the new `schema.sql`; v1 data is left in place but not used or migrated, so teams must be re-created. When you're done with it, you may drop the v1 tables (commented statement at the bottom of `schema.sql`) and delete the `admin@tracker.local` auth user. The `NEXT_PUBLIC_SUPABASE_*` and service-role variables are no longer needed; remove them from Vercel.

## Known limitations
- No email, so there is no "forgot password" for personal accounts. Team-created logins can be reset by their leader.
- Adding an existing user to a team by username doesn't ask for their consent.
- The Supabase TLS certificate is encrypted but not chain-verified (Supabase uses its own CA).
- Drag-and-drop needs a mouse; on touch screens use **Edit** (assignee and status are there).
