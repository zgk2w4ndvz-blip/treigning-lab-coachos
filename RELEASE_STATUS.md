# Treigning Lab CoachOS — Release Status

**Honest assessment. Last updated: 2026-06-05.**

> TL;DR — This is a polished, feature-rich **frontend prototype** running entirely
> on mock/local data in dev-bypass mode. The Supabase + Clerk backend is *written
> but never executed against live services*, there are *zero automated tests*, and
> several user-visible actions don't persist. It is **not** production-ready.
> Treat the "feature complete" appearance with skepticism: the hard 20% (real
> data integration, auth, security verification, persistence) is what remains.

---

## 1. Current completion percentage

A single number is misleading, so here it is by layer:

| Layer | Completion | Notes |
|---|---|---|
| UI / pages / components | **~90%** | All major screens built and render |
| Frontend logic (charts, projections, alert engine, compliance) | **~85%** | Pure logic solid; unit-tested = 0% |
| Data model / migrations / RLS | **~80% written, 0% verified** | Never run against a live DB |
| Real backend integration (Supabase/Clerk) | **~25%** | Code paths exist, never exercised end-to-end |
| Persistence of writes (settings, tasks, logs) | **~30%** | Client CRUD persists (local/Supabase code); most else is optimistic |
| Security (auth + RLS in practice) | **~30%** | Designed well, unverified |
| Testing | **0%** | No unit/integration/E2E |
| Observability / ops | **~5%** | None beyond build output |

**Honest blended figure: ~55–60% to a real production launch.** The app *demos*
at ~90%; the gap is the unglamorous, high-risk integration work.

---

## 2. Working features (verified in dev bypass)

These render and function correctly with mock/local data:

- Coach shell: sidebar nav, topbar, route protection (bypass no-op), role-gated layout.
- **Clients:** roster list (search/filter), 360° overview, per-domain tabs.
- **Client CRUD + CSV import:** add / edit / delete / roster-management page; CSV paste+upload with preview; imported roster replaces demo data across all pages. *(Persists to local store in bypass; Supabase code path written.)*
- **Athlete tracking pages** (weight, nutrition, hydration, supplements, recovery, training): charts, trends, 0–100 compliance, 7/30/90-day range selector, log forms (UI).
- **Combat module:** weight cuts, weigh-in timeline, auto-generated protocols, readiness gauge, coach board.
- **Wrestling Command Center:** projections, daily/weekly targets, cut-risk, pace buckets.
- **Competition module:** unified event board, prep checklists, hydration + fueling reminders.
- **Daily Agenda:** per-athlete roll-up with priority/readiness/compliance/alerts + filters.
- **Dashboard, Tasks, Calendar (month/week), Settings, Alerts** pages.
- **Alert engine** computes live across all modules.
- Builds clean: `tsc`, `eslint`, `next build` (32 routes) all pass.

---

## 3. Partially completed features

- **Real Supabase/Clerk mode** — every read/write has a real-mode branch, but it
  has **never been run** against a live project. Unknown defects likely.
- **CSV import (real mode)** — inserts core `clients` columns only; does *not* yet
  create related `weight_goals` / `competitions` / `weight_logs`, so charts and
  competition views stay empty for imported athletes until logged.
- **Log forms (weight/nutrition/hydration/recovery/training/supplements)** —
  Server Actions exist and target Supabase, but are **blocked in bypass** and
  unverified in real mode; no persistence demonstrated.
- **Tasks** — list/filter/buckets work; "mark complete" is **optimistic only**
  (no `createTaskAction`/persistence). Imported-roster tasks are generated, not stored.
- **Settings** — full form UI; **Save is a toast only** (not written to `coach_settings`).
- **Alerts** — computed live and displayed; **not persisted**, recomputed every
  request; no acknowledge/resolve workflow despite the schema supporting it.
- **Combat/wrestling/competition real data** — depend on `weight_cuts` rows; the
  only creation path is the per-client cut form (unverified in real mode).

---

## 4. Missing features (not started)

- **Athlete (client) portal** — `app/(client)/today` is a stub; no self-serve logging.
- **Messaging / communications** — tables exist; Messages tab is a stub; no Realtime.
- **Notifications** — email/SMS/push delivery (prefs are UI-only).
- **Client invite / claim flow** — `client_invites` table exists; no UI/token flow.
- **File uploads** — progress photos / meal pics (Supabase Storage) — schema has
  `photo_url` fields, no upload UI/storage wiring.
- **Multi-coach orgs / admin role** — `admin` role reserved; no org/team support.
- **Automated tests** — none.
- **Observability** — error tracking, logging, rate limiting, analytics.
- **Scheduled jobs** — alert evaluation / nightly rollups (`pg_cron`/Edge Functions).
- **Billing / subscriptions** — none (if this is a commercial SaaS).

---

## 5. Critical blockers

Ranked. These must be resolved before any real user touches the system.

1. **No live backend has ever run.** Supabase + Clerk are configured with dummy
   keys; the entire app is exercised only in bypass. First connect will surface
   integration bugs (token/RLS config, query mismatches, the hand-written
   `Database` type drifting from real SQL). **Highest risk, unknown size.**
2. **RLS is unverified.** Policies are written but never enforced against real
   sessions. A misconfigured Clerk↔Supabase token would silently break tenant
   isolation — a data-leak risk. Must be tested adversarially.
3. **Writes don't persist** for settings, task completion, and (in practice) logs.
   The app *looks* interactive but loses data — unacceptable for real use.
4. **Zero tests** over critical pure logic (alert engine, cut projection,
   compliance, CSV parsing) and zero E2E coverage of auth/CRUD.
5. **Dev-bypass safety** — the bypass is gated on `NODE_ENV !== production`, but
   this single flag is the only thing standing between "no auth" and a prod
   deploy. Needs a deliberate config review + a guard test before launch.

---

## 6. Production readiness assessment

**Verdict: NOT production-ready. Roughly "advanced prototype / pre-alpha" for real data.**

| Dimension | State |
|---|---|
| Functionality (demo) | Strong |
| Real data path | Unproven |
| Data persistence | Incomplete |
| Auth enforcement (live) | Unverified |
| Tenant isolation (RLS live) | Unverified |
| Error handling / empty states | Decent (UI), weak on failed writes |
| Tests | None |
| Observability | None |
| Performance at scale | Untested; alert engine recomputes per request (O(clients) queries) — likely fine <50 clients, risky beyond |
| Mobile/responsive | Reasonable, not audited |
| Accessibility | Not audited |

Shipping to a single friendly pilot coach with real data is feasible only after
blockers 1–3 are cleared and a basic test pass exists.

---

## 7. Security readiness assessment

**Verdict: Architecturally sound, operationally unverified. Do not expose publicly yet.**

Strengths:
- Defense-in-depth design: Clerk auth + Postgres RLS on every table.
- Service-role client isolated to the webhook; `server-only` boundaries in place.
- Webhook signature verification (svix) implemented.
- Secrets via env; `.env.local` and `.dev-data/` gitignored.

Risks / must-fix before launch:
- **RLS never tested with real JWTs** — the central isolation guarantee is
  unproven. Requires explicit multi-tenant tests (coach A cannot see coach B).
- **Clerk↔Supabase token integration unconfigured** in practice — if `accessToken`
  isn't accepted, either everything fails (safe) or RLS silently no-ops (unsafe).
  Verify which.
- **Dev bypass must be impossible in prod** — confirm `NEXT_PUBLIC_DEV_AUTH_BYPASS`
  is unset/false in prod env and add a startup assertion/test.
- No **rate limiting**, no **input hardening review** beyond Zod, no **dependency
  audit** (`npm audit` had moderate advisories at scaffold time — re-check).
- No **CSRF/abuse** considerations for the webhook beyond signature, no logging of
  auth failures.
- Hand-written `Database` types can mask schema/permission mismatches.

No formal security review has been performed.

---

## 8. Estimated effort remaining (hours)

Honest ranges for **one experienced full-stack engineer**, including debugging
and the integration "unknown unknowns." These are not best-case numbers.

| Workstream | Hours |
|---|---|
| Connect live Supabase + Clerk; configure third-party auth; run migrations; first real end-to-end pass | **16–32** |
| Verify + fix RLS (adversarial multi-tenant tests) | **8–16** |
| Make writes persist: settings, task CRUD, verify all log-form actions in real mode | **16–28** |
| CSV import → related records (goals/competitions/weight logs) in real mode | **6–12** |
| Regenerate DB types from live schema; fix drift | **3–6** |
| Test suite: unit (pure logic) + a few E2E (auth, client CRUD, import) | **24–40** |
| Alert persistence + scheduled evaluation (pg_cron/Edge) | **12–24** |
| Error handling for failed writes, loading/error states audit | **8–16** |
| Observability (error tracking, logging) + rate limiting | **8–16** |
| Security pass (bypass guard, dep audit, headers, webhook hardening) | **8–16** |
| Athlete/client portal (self-serve logging) | **30–50** |
| Messaging + Realtime | **24–40** |
| Notifications (email/SMS) | **16–28** |
| Mobile/responsive + a11y audit | **12–24** |
| Billing/subscriptions (if commercial) | **24–48** |

- **MVP-launch subset (blockers + persistence + minimal tests + security pass):
  ~100–180 hours (≈ 3–5 focused weeks).**
- **Full vision (incl. portal, messaging, notifications, billing): ~250–430 hours.**

Estimates carry real variance because the live-integration risk is unquantified
until the first real connect.

---

## 9. Recommended development order

Dependency-ordered; each step de-risks the next.

1. **Stand up a real Supabase project + Clerk app**; run migrations `0001`–`0004`;
   set real env; configure Clerk as Supabase third-party auth. *(Unblocks all.)*
2. **End-to-end smoke in real mode:** sign up → profile synced → add a client →
   it appears. Fix whatever breaks (expect query/type/RLS fixes).
3. **Verify RLS** with two coaches; write isolation tests. Lock down the bypass.
4. **Make writes persist:** settings → `coach_settings`; task create/complete;
   confirm all six log forms write + revalidate.
5. **Regenerate `types/database.ts`** from the live schema; resolve drift.
6. **Minimal test suite:** Vitest for `lib/alerts`, `lib/wrestling`,
   `lib/metrics`, `lib/import`; Playwright for auth + client CRUD + CSV import.
7. **Alert persistence + scheduled evaluation** (stop recomputing per request).
8. **CSV real-mode related records**, error handling on failed writes, observability.
9. **Security pass** (bypass guard test, `npm audit`, headers, webhook).
10. **Then** feature expansion: client portal → messaging → notifications →
    mobile/a11y → billing.

---

## 10. MVP launch requirements

Definition of "MVP" = a real coach can manage a real roster with confidence and
data is safe. Required (all must be true):

- [ ] Live Supabase + Clerk connected; migrations applied; third-party auth working.
- [ ] Real end-to-end verified: sign-up → client CRUD → CSV import → all read pages.
- [ ] **RLS proven** to isolate coaches (automated multi-tenant test).
- [ ] Dev bypass **provably off** in production (config + guard test).
- [ ] Writes persist: settings, tasks, and all athlete log forms.
- [ ] CSV import creates usable data (at minimum clients; ideally related records).
- [ ] Failed-write error handling + user feedback (no silent data loss).
- [ ] Smoke test suite green in CI; `tsc`/`eslint`/`build` gated.
- [ ] Basic observability (error tracking) + `npm audit` clean of high/critical.
- [ ] A real coach completes a pilot week without data loss or cross-tenant leakage.

Explicitly **out of MVP scope** (fast-follow): athlete portal, messaging,
notifications, billing, file uploads, multi-coach orgs.

---

### Bottom line
The product design and frontend are genuinely strong and far along. But "looks
done" ≠ "is done": the remaining work is the backend integration, persistence,
security verification, and testing that turn a convincing demo into a system you
can trust with real athletes' data. Budget **3–5 focused weeks to a credible MVP**,
and do not launch publicly until RLS isolation and the dev-bypass guard are tested.
