# CoachOS L2 Spine — Design Specification (Architecture RFC)

> **Status:** DRAFT / RFC v0.1 — for review and challenge. Nothing here is built.
> **Author:** Lead Systems Architect (CoachOS)
> **Companion docs:** `SYSTEM_ARCHITECTURE.md` (current system), `MESSAGE_INGESTION.md`
> (current ingestion pipeline), `PROJECT_HANDOFF.md` (status/roadmap).
> **Scope of this RFC:** define the *target* architecture for a canonical
> **Observation Store** ("L2 Spine") and the path to it. **No code, no migrations,
> no PRs.** This document is meant to be argued with before anything ships.

---

## 0. Why this document exists

CoachOS today has an excellent **ingestion-and-approval pipeline** but **no single
canonical record of athlete data**. Every signal lands in its own domain table
(`weight_logs`, `recovery_logs`, `body_measurements`, `biomarkers`,
`metabolic_assessments`, …). That has served well, but it means:

- There is **no one place** to ask "what do we know about this athlete, from any
  source, as of any date?"
- Each new connector or signal type tends to grow **another bespoke write path**
  in the approval gate (`reviewSuggestionAction` already special-cases
  `create_weight_log`, `body_composition_update`, `recovery_import`, and "else →
  prescription + task").
- The planned **Athlete Intelligence Graph** has no substrate to read from.

The **L2 Spine** introduces exactly one new idea: a **canonical, append-only
Observation Store** that becomes the source of truth for approved athlete data.
It is deliberately a *thin* addition. It does **not** replace the ingestion
pipeline, the connector framework, the AI layer, or the approval gate — it gives
them a shared destination.

### Naming: what "L2" means

We define four layers. The Observation Store is **L2**, the spine that everything
else hangs off of.

| Layer | Name | What lives there | Current artifacts |
|---|---|---|---|
| **L0** | **Capture** | Raw inbound, verbatim | `message_ingest`, connector raw `RecoverySample` |
| **L1** | **Interpretation** | Extracted + matched candidate signals, *pending* | `suggested_actions`, `lib/messages/analyze`, `lib/ai/*` |
| **L2** | **Observation Store (Spine)** | Canonical, coach-approved, immutable observations | **NEW** (`observations`) |
| **L3** | **Projections & Intelligence Graph** | Domain tables + derived views/analytics | `weight_logs`, `recovery_logs`, … + future graph |

The **coach-approval gate sits between L1 and L2.** That is the single trust
boundary, and it does not move.

---

## 0.1 Decision log (resolved)

These were the open questions from RFC v0.1 §12. They are now **settled** and
binding for implementation. The original §12 entries are marked RESOLVED and point
back here.

| # | Decision | Resolution (binding) |
|---|---|---|
| **D1** | **Replace vs. coexist** | **Coexist for the foreseeable future.** The Observation Store becomes the canonical **intelligence layer**; domain tables remain **operational projections and a compatibility/fallback layer**. Do **not** delete or fully replace domain tables until the system has proven parity over time. Domain tables are *not* technical debt to remove — they are a deliberate, retained projection surface. P4 ("cutover") is therefore re-scoped from "replace" to "make observations canonical *while* keeping projections live." |
| **D2** | **Client self-logging** | **Default to coach approval.** Anything that materially affects plans, alerts, readiness, prescriptions, injury status, or coaching decisions **must** pass the approval gate — self-logging never bypasses it. Low-risk metrics (e.g. daily body weight, water intake) **may** later be auto-approved, but only via an **explicit, visible, configurable policy**. Until that policy exists, **everything routes through approval.** |
| **D3** | **Observation granularity** | **One row per metric**, with a shared **`reading_group_id`** linking metrics that arrive together. One TreigningLab recovery import yields separate observations for HRV, resting HR, recovery score, hydration, … all sharing one `reading_group_id`. This is now a **first-class column**, not optional. |

---

## 1. Architecture principles

These are the rules every L2 Spine decision is measured against. They restate and
extend the project's existing operating principles.

1. **One source of truth per fact.** Once L2 exists, the canonical value of any
   approved athlete observation lives in the Observation Store. Domain tables
   become *projections* of it, not parallel truths.
2. **Extend, don't replace.** The Observation Store is additive. The existing
   ingestion pipeline, approval gate, connector framework, and domain tables keep
   working unchanged until each is *deliberately* migrated. No big-bang rewrite.
3. **One ingestion pipeline.** Every connector and every message source funnels
   through the *same* `capture → interpret → suggest → approve → commit` path.
   The Connector Framework v2 is the ingestion layer for the store, **not** a
   second subsystem. (We already do this for recovery via synthetic
   `message_ingest` rows — we generalize it.)
4. **AI enriches, never authors.** AI may normalize, score, route, and
   disambiguate in **L1 only**. It never produces an L2 observation directly. An
   AI-touched signal is still a *pending suggestion* a coach must approve.
5. **The coach is the only writer to truth.** Nothing reaches L2 without passing
   `reviewSuggestionAction` (or its generalization). This is unchanged from today.
6. **Append-only, immutable observations.** Observations are never updated in
   place. Corrections **append** a new observation that supersedes the prior one.
   This gives a perfect audit trail and makes idempotency tractable.
7. **Idempotent everywhere.** Re-ingesting the same source artifact, re-approving,
   or re-running a connector must never create a duplicate observation. Every
   write is keyed.
8. **Schema-first and additive.** Every schema change is a migration with RLS,
   nullable/back-compatible columns, and an idempotency index — shipped before
   the code that uses it.
9. **Independently deployable phases.** Each phase is shippable and reversible on
   its own; no phase requires the next to be safe in production.
10. **Feature-flagged AI with hard cost caps.** Anthropic only, behind
    `AI_ENABLED`, with the per-day USD cap and `ai_usage` ledger. Default off.
11. **RLS is the backstop.** Every new table is coach-scoped via
    `current_profile_id()`, exactly like the rest of the schema. Service-role only
    in webhook/bridge/cron.
12. **Simplicity over cleverness.** If a phase can be skipped because an existing
    system already solves the problem, skip it. (See §13 — several "obvious"
    builds are explicitly *not* recommended.)

---

## 2. Core data model

### 2.1 The `observations` table (the L2 spine)

One row = **one canonical fact about one athlete, at one point in time, from one
source.** Append-only.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `coach_id` | uuid → profiles | RLS scope (mirrors every existing table) |
| `client_id` | uuid → clients | the athlete; **NOT NULL** in L2 (unmatched stays in L1) |
| `domain` | **text (app-validated)** | registry domain (`body_composition`, `recovery`, `metabolic`, `low_base`, `diet`, …). **Not** a DB enum — validated against the Metric Registry in `commit.ts`; a lightweight snake_case `CHECK` guards format only |
| `metric` | **text (app-validated)** | **canonical metric key** from the registry (§2.3), e.g. `body_weight_lbs`, `hrv_rmssd_ms`, `resting_hr_bpm`, `body_fat_pct`. Not a DB enum/FK; validity is enforced by `getMetric()` in `commit.ts`, with a snake_case `CHECK` for format |
| `value_num` | numeric | quantitative value (nullable) |
| `value_text` | text | qualitative value, e.g. a note (nullable) |
| `value_json` | jsonb | structured payloads that aren't a single scalar (nullable). `CHECK (num_nonnulls(value_num, value_text, value_json) >= 1)` |
| `unit` | text | canonical unit for the metric (`lbs`, `bpm`, `ms`, `pct`, `score`, …) |
| `observed_at` | timestamptz | **when the fact pertains to** (the athlete-day/time), not when we learned it |
| `source` | text | connector id or message source (`treigninglab`, `gmail`, `imessage`, `manual`, `coach`) |
| `ingested_via` | text (app-validated) | the pipeline **channel**: `message` \| `connector` \| `manual` \| `coach_entry` |
| `source_ref` | text | stable per-`(source, external athlete, metric, observed_at)` key for idempotency. Per-metric (see §5) so each metric in a bundle is distinct |
| `reading_group_id` | uuid | **[D3]** links metrics captured together (one InBody scan, one recovery import). NULL for standalone observations. Not unique — many rows share it |
| `confidence` | numeric(4,3) | provenance/extraction confidence; coach-approved facts default 1.0 |
| `sensitive` | boolean | labs/injury/medical — surfaced for explicit handling, never auto-actioned |
| `suggested_action_id` | uuid **FK → suggested_actions(id) ON DELETE SET NULL**, nullable | provenance link to the L1 suggestion. **Nullable FK**, not a soft link: no cycle exists (`suggested_actions` has no column pointing at `observations`); `SET NULL` (never CASCADE) so deleting a suggestion can never erase a canonical observation. NULL for manual/connector/migration rows |
| `supersedes_id` | uuid → observations(id) ON DELETE SET NULL | correction chain; NULL = original (reserved; unused in P1) |
| `superseded_by_id` | uuid → observations(id) ON DELETE SET NULL | set when a later row corrects this one (denormalized for fast "current" reads) |
| `created_by` | uuid → profiles(id) ON DELETE SET NULL | the **human actor** profile when applicable (approving/entering coach, future athlete); NULL for connector/system/migration |
| `created_by_type` | text (app-validated) | **actor class** that caused the commit: `coach` \| `connector` \| `athlete` \| `system` \| `migration`. Complements `ingested_via` (channel) and `created_by` (which human) — see §2.4 |
| `committed_at` | timestamptz NOT NULL default now() | when the observation became **canonical** (the approval/commit moment) — distinct from `observed_at` (measured) and `created_at` (row insert) |
| `created_at` | timestamptz NOT NULL default now() | DB row-insert timestamp |

**Idempotency:** `unique (coach_id, source, source_ref) where source_ref is not
null` — directly mirrors the existing `message_ingest_external_uq` and
`recovery_logs_source_ref_key` patterns. `source_ref` is **per-metric** (e.g.
`${recoverySourceKey}:${metric}`, §5) so each metric in a `reading_group` is a
distinct row. Manual/coach entries (`source_ref` NULL) are unconstrained, exactly
as manual `recovery_logs` are today.

**"Current value" semantics:** the live value of a metric is the observation with
no `superseded_by_id`. A view (`observations_current`) materializes this for
readers. Corrections never delete; they append + chain.

### 2.2 Why these choices (balanced critique up front)

- **One row per metric, with `reading_group_id` for bundles. [D3 — decided]** A
  BIA/InBody scan yields ~6 metrics; a wearable day yields several. One row per
  metric keeps the model uniform, makes the metric registry the single extension
  point, and lets the Intelligence Graph query by metric without unpacking JSON.
  Bundle context is preserved by the **first-class `reading_group_id`**: every
  metric from a single import/scan shares one group id, so "show me that whole
  InBody scan" is one `where reading_group_id = …` query while "trend HRV" stays a
  clean per-metric scan. The rejected alternative (one row + `value_json` per
  bundle) is cheaper to write but worse to query and analyze, and breaks registry
  alignment.
- **`value_num` / `value_text` / `value_json` split** rather than a single
  polymorphic JSON column: keeps the 90% case (a number) indexable and cheap,
  while not losing structured or qualitative data. EAV-style designs rot; this is
  a constrained, registry-governed variant, not open EAV.
- **`observed_at` vs `created_at`** are deliberately distinct — the current
  recovery model already separates `measured_at` (provider) from `created_at`.
  Time-series correctness depends on this.

### 2.3 The Metric Registry (`lib/observations/registry.ts`)

A **code-level, typed catalog** (not a table, at least initially — see §12) of
every canonical metric: key, domain, unit, value kind (`num|text|json`), valid
range, and which legacy domain table it projects to. This is the contract that
keeps connectors, the AI normalizer, and the projection layer agreeing on names.
Example entries:

```
body_weight_lbs    → domain: body_composition, unit: lbs,  kind: num → weight_logs.weight_lbs
body_fat_pct       → domain: body_composition, unit: pct,  kind: num → weight_logs.body_fat_pct
hrv_rmssd_ms       → domain: recovery,         unit: ms,   kind: num → recovery_logs.hrv
resting_hr_bpm     → domain: recovery,         unit: bpm,  kind: num → recovery_logs.resting_hr
recovery_score     → domain: recovery,         unit: score,kind: num → recovery_logs.recovery_score
recovery_hydration_pct → domain: recovery,     unit: pct,  kind: num → recovery_logs.hydration
```

> Column names above match the **shipped** P0 registry (`lib/observations/registry.ts`,
> PR #29): HRV projects to `recovery_logs.hrv` and body fat to `weight_logs.body_fat_pct`.

The registry is the single place a new signal is "made real." Adding a wearable
metric is: add a registry entry + (optionally) a projection target. No new table,
no new approval branch.

### 2.4 The provenance triad — `ingested_via` / `created_by_type` / `created_by`

Three fields describe an observation's origin from three angles, deliberately kept
distinct (and not collapsed, to avoid losing information):

| Field | Question it answers | Values |
|---|---|---|
| `ingested_via` | **Through what channel** did the underlying signal arrive? | `message` · `connector` · `manual` · `coach_entry` |
| `created_by_type` | **What class of actor** caused the L2 commit? | `coach` · `connector` · `athlete` · `system` · `migration` |
| `created_by` | **Which human** (profile), if any? | a `profiles.id`, or NULL |

They are complementary, not redundant. Worked examples:

| Scenario | `ingested_via` | `created_by_type` | `created_by` |
|---|---|---|---|
| Coach approves an athlete's texted weight | `message` | `coach` | the coach |
| Coach approves a TreigningLab recovery import | `connector` | `coach` | the coach |
| Coach types a value directly into the UI | `manual` | `coach` | the coach |
| (Future) athlete self-logs body weight | `manual` | `athlete` | the athlete |
| (Future) auto-approved low-risk metric [D2] | `connector`/`manual` | `system` | NULL |
| Historical backfill of legacy domain rows (P4) | `migration` | `migration` | NULL |

> Note: `created_by_type` is a small, stable, closed set, so a `CHECK` constraint
> (or it could be a DB enum) is acceptable here — unlike `metric`/`domain`, it does
> not grow as the registry grows.

---

## 3. Observation lifecycle

```
 L0 CAPTURE            L1 INTERPRET                 GATE            L2 COMMIT            L3 PROJECT
┌──────────┐   ┌──────────────────────────┐   ┌──────────┐   ┌────────────────┐   ┌──────────────┐
│ raw       │   │ extract + match +        │   │  COACH   │   │ observations    │   │ domain tables │
│ inbound   │──▶│ (optional AI normalize)  │──▶│ approval │──▶│ (append-only,   │──▶│ + Intelligence│
│ message / │   │ → suggested_actions      │   │ review…  │   │  idempotent,    │   │ Graph (views) │
│ sample    │   │   (status='pending')     │   │ Action() │   │  canonical)     │   │               │
└──────────┘   └──────────────────────────┘   └──────────┘   └────────────────┘   └──────────────┘
   immutable        candidate, not truth        only writer        SOURCE OF TRUTH     derived/cache
```

1. **Capture (L0).** A message arrives (`message_ingest`) or a connector emits a
   sample. Stored verbatim. No interpretation. *Already exists.*
2. **Interpret (L1).** `analyzeMessage` (deterministic `extract` + `classify`),
   optionally enriched by AI normalization/routing, produces zero-or-more
   `suggested_actions(status='pending')`, matched to an athlete. *Already exists;
   AI enrichment generalizes the current extraction.*
3. **Approve (the gate).** The coach approves/edits/rejects in the inbox
   (`reviewSuggestionAction`). **This is the only path to L2.** *Already exists.*
4. **Commit (L2).** On approval, the gate writes **one-or-more immutable
   `observations`** (idempotent via `source_ref`). This is the new step — and it
   *replaces the ad-hoc per-action branches* with a uniform "emit observations"
   call driven by the metric registry.
5. **Project (L3).** Each committed observation projects into its legacy domain
   table (`weight_logs`, `recovery_logs`, …) for backward compatibility, and feeds
   the Intelligence Graph. **During transition this is a dual-write; long-term the
   domain tables become read-through projections** (§11).
6. **Correct.** An edited/re-approved value appends a superseding observation;
   the projection updates; the audit chain is preserved. Never a destructive
   update.

---

## 3A. Observation Lifecycle Examples

Concrete end-to-end traces, showing exactly which artifacts are touched and what
the resulting `observations` row(s) look like. **Provenance fields** are called out
because they're the part most easily gotten wrong. In all cases the **coach
approval gate is the only writer to L2** (except the explicitly-flagged future
auto-approval case, which is itself a coach-configured policy).

### 3A.1 Incoming athlete message

> *Julian texts "Morning weight 128.4".*

```
L0  message_ingest row (source='imessage', body, received_at)
L1  analyzeMessage → suggested_actions(status='pending', domain='body_composition',
        details.action='create_weight_log', entries=[{label:'morning', weightLbs:128.4}])
GATE coach approves in /inbox  → reviewSuggestionAction (create_weight_log branch)
L2  DOMAIN WRITE  → weight_logs row (weight_lbs=128.4, logged_at=message day @ 07:00)   [unchanged path]
    OBS WRITE     → observations:
        metric=body_weight_lbs  value_num=128.4  unit=lbs  domain=body_composition
        observed_at=<message day 07:00>  source='imessage'  ingested_via='message'
        created_by_type='coach'  created_by=<coach>  suggested_action_id=<sa.id>
        source_ref='imessage:<msg-guid>:body_weight_lbs'  reading_group_id=<g1>
        committed_at=now()  confidence=1.0
```
*(Note: weight is the **second** dual-write vertical; shown here for completeness.
P1 wires recovery first — §3A.2.)*

### 3A.2 TreigningLab connector sync — **the P1 vertical**

> *Nightly recovery sync pulls Maya's HRV 84, RHR 48, recovery 91, hydration 76.*

```
L0  ObservationConnector.fetchSamples() → ObservationSample (connector='treigninglab',
        observed_at=2026-06-26, metrics={hrv:84, restingHr:48, recoveryScore:91, hydration:76})
L1  runObservationSync → match athlete (external_athlete_map) → synth message_ingest
        → suggested_actions(status='pending', domain='recovery', action='recovery_import')
GATE coach approves  → reviewSuggestionAction (recovery_import branch, inbox.ts:351)
L2  DOMAIN WRITE  → writeRecoveryLog → ONE recovery_logs row (hrv=84, resting_hr=48,
        recovery_score=91, hydration=76, source='treigninglab', source_ref=<key>)   [unchanged path]
    OBS WRITE     → observations (FOUR rows, one reading_group):
        reading_group_id=<g2> for all four; source='treigninglab'; ingested_via='connector';
        created_by_type='coach'; created_by=<coach>; suggested_action_id=<sa.id>;
        committed_at=now(); confidence=1.0
        ├ metric=hrv_rmssd_ms          value_num=84  unit=ms    source_ref='treigninglab:maya:2026-06-26:hrv_rmssd_ms'
        ├ metric=resting_hr_bpm        value_num=48  unit=bpm   source_ref='…:resting_hr_bpm'
        ├ metric=recovery_score        value_num=91  unit=score source_ref='…:recovery_score'
        └ metric=recovery_hydration_pct value_num=76 unit=pct   source_ref='…:recovery_hydration_pct'
```
Re-approval / re-sync of the same athlete-day → `source_ref` collision → **0 new
rows** (idempotent), matching `recovery_logs`' own `(client_id, source_ref)` guard.

### 3A.3 Manual coach entry

> *Coach types a metabolic VO2 max of 52 directly into the UI (no message, no connector).*

```
L0  none (no inbound artifact)
L1  none (no suggestion) — OR a trivial pass-through; manual entry is coach-authored
GATE the coach IS the actor; the act of saving is the commit
L2  DOMAIN WRITE  → metabolic_assessments row (vo2_max=52)                          [existing path]
    OBS WRITE     → observations:
        metric=vo2_max  value_num=52  unit=ml_per_kg_min  domain=metabolic
        observed_at=<assessment date>  source='manual'  ingested_via='manual'
        created_by_type='coach'  created_by=<coach>  suggested_action_id=NULL
        source_ref=NULL (manual → unconstrained, like manual recovery_logs)
        reading_group_id=<g3 if part of a multi-field assessment, else NULL>
```
Key point: `suggested_action_id` and `source_ref` are **NULL** — the nullable FK
and the partial idempotency index both accommodate origin-less coach entries.

### 3A.4 Future athlete self-entry

> *Athlete logs their own morning weight in a future client portal.*

```
L1  athlete-entered value → DEFAULT [D2]: becomes suggested_actions(status='pending')
GATE coach approves (default policy) → reviewSuggestionAction
L2  OBS WRITE → observations: ingested_via='manual', created_by_type='athlete',
        created_by=<athlete profile>, suggested_action_id=<sa.id>
        — i.e. the actor is the athlete, but the COMMIT still passed the coach gate.

   OR, once an explicit low-risk auto-approval policy exists [D2, §6.1]:
GATE policy auto-approves body_weight_lbs (sensitive domains never eligible)
L2  OBS WRITE → observations: ingested_via='manual', created_by_type='system',
        created_by=NULL, suggested_action_id=<sa.id>, confidence < 1.0
        — committed without a manual coach step, but ONLY because the coach
          configured the policy. The provenance triad records that it was a
          system commit, not a coach decision.
```

### 3A.5 Future correction / supersession

> *A connector value was wrong (HRV 84 should be 48); a corrected sample arrives,
> or the coach edits the value.*

```
Existing row R1:  metric=hrv_rmssd_ms value_num=84 superseded_by_id=NULL  (the "live" value)
GATE coach approves the correction
L2  APPEND R2:  metric=hrv_rmssd_ms value_num=48
        supersedes_id=R1.id   source_ref='…:hrv_rmssd_ms:v2'  committed_at=now()
        created_by_type='coach' (or 'connector' if a corrected sample drove it)
    UPDATE R1:  set superseded_by_id=R2.id      ← the ONLY mutation allowed: linking the chain
RESULT  "current HRV" = the row WHERE superseded_by_id IS NULL = R2 (value 48).
        R1 is retained forever (audit). The L3 projection (recovery_logs) updates to 48.
```
Append-only is preserved: values are never overwritten; the sole in-place write is
stamping `superseded_by_id` on the prior row to close the chain. **Reserved in the
schema from P1; the correction flow itself is implemented in a later phase.**

---

## 4. Connector model

The Connector Framework **v2 becomes the L0/L1 ingestion layer for the store**,
not a separate path. We generalize the existing recovery contract.

### 4.1 From `RecoveryConnector` to `ObservationConnector`

Today (`lib/recovery/types.ts`):

```
RecoveryConnector.fetchSamples() → RecoverySample[]   // recovery metrics only
```

Target (superset, backward compatible — `RecoverySample` becomes a special case):

```
ObservationConnector.fetchSamples() → ObservationSample[]
  ObservationSample = {
    connector, external: ExternalAthlete, observed_at,
    metrics: { [canonicalMetricKey]: number | string | json },   // registry-keyed
    notes?, source_ref_base?
  }
```

`RecoveryMetrics` (already a superset with `sleepHours`, `readiness`, `soreness`,
`bodyBattery` reserved) maps cleanly onto registry metric keys. A Whoop/Oura/
Garmin connector implements the same contract and emits registry-keyed metrics —
no engine change.

### 4.2 Reuse, don't rebuild

The connector plumbing **already exists and is reused as-is**:

| Concern | Existing artifact | Change |
|---|---|---|
| Enable/disable + cursor + config | `sync_connectors` | reuse unchanged |
| External→athlete matching | `external_athlete_map` + `matchRecoveryAthlete` | reuse; rename matcher to `matchObservationAthlete` |
| Idempotency + incremental cursor | `recovery_sync_state` | **generalize** to `ingest_sync_state` (connector, external athlete, day) — recovery is one consumer |
| Sync engine | `runRecoverySync` | **generalize** to `runObservationSync`; recovery becomes a thin caller |
| Funnel into approval | synthetic `message_ingest` → `suggested_actions` | reuse exactly — this is *the* unification mechanism |

The key insight already in the codebase: `runRecoverySync` **synthesizes a
`message_ingest` row** so synced data uses the same inbox/approval UI as messages.
That pattern is the blueprint — every connector becomes "produce samples → emit
pending suggestions → coach approves → observations."

---

## 5. AI model

**Unchanged fences, generalized role.** The AI layer (`lib/ai/*`) is already
well-isolated: `provider.ts` abstracts the vendor (Anthropic), `call.ts` enforces
the `AI_ENABLED` kill switch, a per-day USD cap (`withinDailyCap` against the
`ai_usage` ledger), a 15s timeout + single retry, and **returns `null` → caller
falls back to the deterministic path.** None of that changes.

What changes is *where AI plugs in*: it remains an **L1 enrichment**, never an L2
author.

| AI use | Layer | Behavior | Guardrail |
|---|---|---|---|
| Message extraction (today) | L1 | free text → structured signals | deterministic `extract.ts` fallback |
| **Normalization** (target) | L1 | map messy inputs → canonical registry metric/unit | registry is the schema; AI only fills it |
| **Routing** (AI Router, PR #23) | L1 | regex-first, AI only on ambiguity → domain/connector | regex path wins when confident |
| Confidence scoring | L1 | annotate suggestion `confidence` | numeric only; coach still approves |

**Hard rule (principle #4):** an AI-produced value is always a *pending
suggestion*. It cannot become an observation without the coach gate. AI does not
write to L2, ever. The `ai_usage` ledger + daily cap + `AI_ENABLED=false` default
remain the controls; an AI outage degrades to deterministic extraction, never to
data loss.

---

## 6. Approval model

**The gate does not move and does not weaken.** `reviewSuggestionAction` remains
the single boundary before athlete truth. Three changes, all additive:

1. **Uniform commit.** Today the gate has bespoke branches:
   `create_weight_log` → `weight_logs`; `body_composition_update` → weight-log
   fields; `recovery_import` → `recovery_logs`; else → `prescriptions` + task.
   In the target, approval calls a **single `commitObservations(suggestion)`**
   that reads the suggestion's registry-keyed payload and emits canonical
   observations. The legacy domain writes become **projections** of those
   observations (§7), not parallel hand-written branches. This removes the main
   source of "every new signal grows another approval branch."
2. **Edits append, not overwrite.** An edited approval mints a superseding
   observation (immutability, §2). Reject still just marks the suggestion.
3. **Sensitive handling preserved.** `sensitive` (supplements/labs/injury) carries
   from suggestion → observation; medical content is never auto-actioned and is
   surfaced for explicit review, exactly as today.

Prescriptions and coach tasks still spawn on approval where they do today — those
are *actions*, distinct from *observations*. (An observation is "what we know"; a
prescription is "what the coach decided." Keeping them separate avoids the
duplicate-concept trap.)

### 6.1 Approval policy (client self-logging) [D2 — decided]

**Default: everything routes through the coach gate.** A linked athlete logging
their own data does **not** silently bypass approval for anything that materially
affects plans, alerts, readiness, prescriptions, injury status, or coaching
decisions. Those are always `pending` until the coach reviews them.

Auto-approval is a **future, opt-in, explicit policy** — never an implicit
default:

- A small **`approval_policy`** (per-coach, later per-metric) declares which
  low-risk metrics (e.g. `body_weight_lbs`, daily `hydration`) may commit to L2
  **without** the gate, with the policy **visible and configurable** by the coach.
- Until that policy exists in the product, **no auto-approval path is built** —
  self-logs become `pending` suggestions like everything else.
- Even an auto-approved observation is still a real observation with full
  provenance (`ingested_via='manual'`, source = the athlete) and an audit trail;
  it is *not* a bypass of the model, it is an explicit coach-configured exception
  to the *manual* step.
- Sensitive domains (labs, injury, supplements) are **never** eligible for
  auto-approval regardless of policy.

This keeps principle #5 ("the coach is the only writer to truth") intact while
leaving a clean, governed path to reduce coach load on trivial daily metrics
later.

---

## 7. Event flow

### 7.1 Connector → observation (target)

```
cron/bridge        ObservationConnector       runObservationSync         inbox (existing)     reviewSuggestionAction        L2 / L3
   │  fetchSamples()      │                          │                          │                       │                      │
   ├─────────────────────►│ ObservationSample[]      │                          │                       │                      │
   │                      ├─────────────────────────►│ match (external_athlete_map)                      │                      │
   │                      │                          │ idempotency (ingest_sync_state)                   │                      │
   │                      │                          │ synth message_ingest + suggested_actions(pending) │                      │
   │                      │                          ├──────────────────────────►│ coach reviews         │                      │
   │                      │                          │                          │ approve ─────────────►│                      │
   │                      │                          │                          │            commitObservations()             │
   │                      │                          │                          │              ├─ INSERT observations (idemp., shared reading_group_id) │
   │                      │                          │                          │              └─ project → recovery_logs/etc. │
```

### 7.2 Message → observation (target)

Identical from "synth/real `message_ingest`" onward — which is the whole point:
**messages and connectors converge at L1 and share one path to L2.**

---

## 8. Domain boundaries

| Boundary | Owns | Must NOT |
|---|---|---|
| **L0 Capture** (`message_ingest`, connector raw) | verbatim inbound + provider ids | interpret, match, or write athlete truth |
| **L1 Interpretation** (`lib/messages/*`, `lib/ai/*`, router) | extraction, matching, AI enrichment, pending suggestions | write to L2; be the source of truth |
| **Approval Gate** (`reviewSuggestionAction`) | the only L1→L2 transition | be bypassed by any connector, AI, or cron |
| **L2 Observation Store** (`observations`) | canonical, immutable, idempotent facts | be mutated in place; be written by anything but the gate |
| **L3 Projections & Graph** (domain tables, views) | back-compat reads + derived analytics | be treated as a second source of truth |

**Trust boundary:** everything left of the gate is *candidate*; everything right
is *committed*. RLS coach-scopes every layer; service-role only at the
bridge/cron edge of L0.

---

## 9. Folder structure (proposed)

Additive; mirrors existing conventions (`lib/recovery/*`, `lib/messages/*`).

```
lib/
├── observations/
│   ├── types.ts          ObservationSample, Observation, ObservationConnector
│   ├── registry.ts       canonical metric catalog (the contract)
│   ├── store.ts          commitObservations(), currentValue(), supersede()  [server-only]
│   ├── project.ts        observation → legacy domain-table projection (compat)
│   └── observations.test.ts
├── connectors/           (generalized from lib/recovery)
│   ├── sync.ts           runObservationSync()  ← generalizes runRecoverySync
│   ├── match.ts          matchObservationAthlete() ← generalizes recovery match
│   └── adapters/
│       ├── treigninglab.ts
│       └── (whoop|oura|garmin).ts   future
├── recovery/             RETAINED as a thin caller of connectors/observations
├── messages/             unchanged (L0/L1); analyze() now emits registry-keyed signals
└── ai/                   unchanged fences; gains normalize/route helpers (L1 only)

supabase/migrations/
└── 00xx_observations.sql        observations + RLS + idempotency index (Phase 1)
└── 00xx_ingest_sync_state.sql   generalize recovery_sync_state (Phase 2)
```

---

## 10. Build order

Each phase is independently deployable, additive, reversible, and leaves
production behavior unchanged until explicitly switched on. The order below is the
**final, decision-aligned sequence** (reflecting D1/D2/D3 in §0.1).

| Phase | Name | Deliverable | Risk | Reversible? |
|---|---|---|---|---|
| **P0** | **Registry** | Metric Registry (`lib/observations/registry.ts`) + this RFC. Code only, **no schema**. Establishes the canonical metric/unit/kind contract all later phases depend on. | none | n/a |
| **P1** | **Observation Store + permanent dual-write** | `observations` table (incl. first-class `reading_group_id` [D3]) + RLS + idempotency index; `commitObservations()` writes observations **alongside** existing domain writes. Domain tables stay authoritative. **Dual-write is the steady state, not a temporary scaffold [D1].** Parity-checked in prod. | low | drop table; flag off |
| **P2** | **Connector Generalization** | Generalize the recovery framework: `ObservationConnector`/`ObservationSample`, `ingest_sync_state` (from `recovery_sync_state`), `runObservationSync` (from `runRecoverySync`). Recovery becomes a thin caller; new wearable metrics flow to suggestions. One import = one `reading_group_id` [D3]. | low–med | recovery path unchanged underneath |
| **P3** | **AI Enrichment** | L1 normalization + AI Router (PR #23) behind `AI_ENABLED`, daily USD cap, `ai_usage` ledger. Still **suggestions-only**; deterministic fallback on `null`. | low (flagged off) | flag off |
| **—** | **Pause / Validation** | **Hard gate.** Prove dual-write parity over time, confirm connector + AI behavior in prod, and make P4 an explicit decision with evidence. No P4 work begins until this passes. | n/a | n/a |
| **P4** | **Canonical Observation Layer** | Reads prefer `observations` (via `observations_current`); domain tables become live **projections + fallback** maintained by `project.ts` and are **retained, not removed [D1]**; idempotent backfill of historical domain rows into observations. | high (isolated) | keep domain tables; revert reads |
| **P5** | **Intelligence Graph** | Athlete Intelligence Graph reads from observations (views / materialized views, refresh strategy TBD §12.11). Bundle reads via `reading_group_id` [D3]. | med | drop views |
| **P6** | **Approval Policy Engine** | Explicit, visible, configurable auto-approval policy for low-risk metrics [D2]. **Carved out of the core build**; ships only after the spine is proven. Sensitive domains hard-excluded. Default remains full coach approval until this exists. | low (opt-in) | policy off → all `pending` |

**Recommended path:** **P0 → P1 → P2 → P3 → PAUSE.** Only after the validation gate
do P4/P5 proceed; P6 is independent and deferred until the spine has proven itself.

### 10.1 Why this sequencing?

Each phase is ordered to **add the least load-bearing risk first** and to keep the
single dangerous step isolated, evidence-gated, and reversible.

- **P0 Registry first** because every later phase (commit, connectors, AI
  normalization, the graph) must agree on metric names/units. Settling the
  contract in code — with no schema — costs nothing to change and prevents
  divergence later. It is the cheapest phase to get wrong and fix.
- **P1 before everything that produces data.** The store and its idempotency keys
  must exist before connectors or AI can target it. Critically, P1 is a
  **dual-write**: observations are written *in addition to* the authoritative
  domain tables, so the store can be validated against ground truth **without ever
  being load-bearing**. Because D1 makes dual-write permanent, there is no
  schedule pressure to "finish" removing it.
- **P2 before P3** because the connector framework is deterministic and already
  proven (recovery ships today); generalizing it is low-risk plumbing. Wiring AI
  on top of an *unvalidated* connector path would conflate two sources of
  uncertainty. Stabilize the deterministic funnel first, then enrich it.
- **P3 stays suggestions-only and flagged off**, so it can ship "dark" and be
  exercised in prod with zero athlete-data risk. AI never becomes load-bearing for
  truth; an outage degrades to deterministic extraction.
- **The Pause is a real gate, not a formality.** It exists so P4 is a deliberate
  decision backed by parity evidence, not a momentum-driven cutover.
- **P4 is reversible specifically because of D1.** "Make canonical" only flips the
  *read path* to `observations_current`. Domain tables are **retained as live
  projections and fallback**, continuously maintained by `project.ts`. If the
  store misbehaves, reverting reads to the domain tables is a config flip with no
  data loss — the old source of truth was never torn out. This is what turns the
  formerly-"high/irreversible" cutover into "high-but-recoverable."
- **P5 after canonical** because the graph should read the canonical layer, not a
  dual-written shadow, to avoid building analytics on data that might still be
  reverted.
- **P6 last and independent** because auto-approval is a *coach-trust* feature, not
  a spine feature. It must not be on the critical path, and per D2 the safe default
  (full approval) holds until it ships. Deferring it keeps P1's commit logic
  minimal and the single gate absolute throughout the core build.

The through-line: **nothing becomes the source of truth until it has run beside the
existing source of truth long enough to prove parity, and the existing source of
truth is never deleted.**

---

## 11. Migration strategy

Schema-first, additive, dual-write-then-cutover — the same discipline the
recovery framework already used (`0024`/`0025` shipped additively with the AI
feature disabled).

1. **Additive schema only.** New columns nullable; new tables with RLS + an
   idempotency index from day one. Never drop or repurpose a column in the same
   migration that adds behavior.
2. **Dual-write (P1).** Approval writes observations *and* the existing domain
   row. Domain tables stay authoritative. Build a parity check (observation vs
   projected row) and run it in prod with real approvals.
3. **Backfill (P4 prep).** A one-shot, idempotent backfill reads existing domain
   tables → emits historical observations (`ingested_via='manual'`,
   `confidence=1.0`, `source_ref` derived from the legacy row id so re-runs are
   no-ops). Backfill is *read-only* against domain tables.
4. **Make canonical (P4) [D1].** Flip reads to `observations_current`. Domain
   tables become projections maintained by `project.ts` and are **retained for the
   foreseeable future** as a compatibility/fallback layer — not dropped on a
   schedule. Removal is a *separate, later* decision gated on proven parity over
   time, not part of this effort.
5. **Idempotency is mandatory at every step.** `(coach_id, source, source_ref)`
   for the store; `ingest_sync_state` for connectors; legacy-row-id-derived
   `source_ref` for backfill. Re-running anything is always safe.
6. **Reversibility.** Through P3, every phase is "flag off / drop new table" with
   zero impact on shipped functionality. Only P4 changes the read path, and it
   retains the old tables as a live fallback.

---

## 12. Open design questions

These are deliberately unresolved — they're where I most want pushback before P1.

1. **~~Replace vs. coexist~~ — RESOLVED [D1], see §0.1.** Coexist: observations are
   the canonical intelligence layer; domain tables remain operational projections
   and fallback, retained (not removed) until parity is proven over time. P4 is
   re-scoped to "make canonical while keeping projections live," not "replace."
2. **~~Granularity~~ — RESOLVED [D3], see §0.1.** One row per metric +
   first-class `reading_group_id` for bundles. (Data-volume/index sizing is still
   worth estimating before P1, but the shape is fixed.)
3. **Metric registry: code vs. table.** A typed code registry is simpler and
   type-safe; a DB table allows coaches to define custom metrics without a
   deploy. Start code-only; revisit if custom metrics become a requirement.
4. **Corrections vs. projections:** when a superseding observation lands, does the
   projection update in place (loses domain-table history) or also append? Likely
   "projection reflects current; observations hold history."
5. **One suggestion → many observations.** A single inbox approval may emit
   several observations (e.g. an InBody scan). How is partial approval / partial
   edit represented? (Per-metric edit, or all-or-nothing per suggestion?)
6. **Where does the AI Router (PR #23) sit** — pre-extraction (L0/L1 boundary) or
   inside L1? Affects whether routing decisions are themselves logged as
   provenance.
7. **~~Client self-logging path~~ — RESOLVED [D2], see §0.1 and §6.1.** Default to
   coach approval; auto-approval only via an explicit, visible, configurable
   per-metric policy (built later), never for sensitive domains. Until that policy
   ships, all self-logs are `pending`. *Remaining sub-question:* exact schema of
   `approval_policy` (per-coach vs per-metric vs per-athlete) — deferred to when
   the auto-approval feature is actually scheduled.
8. **Sensitive data retention/PII.** Labs/injury observations are `sensitive`.
   Do they live in `observations` with stricter RLS, or in a segregated store?
   (Memory notes an HTMA/blood-work "labs vertical" is deferred — this question
   should be answered *with* that work, not before it.)
9. **Time semantics for ranges.** `observed_at` is a timestamp; some observations
   are intervals (a sleep window, a weight-cut phase). Do we need
   `observed_start`/`observed_end`, or is that an L3 concern?
10. **Unmatched observations.** Today unmatched recovery samples are recorded in
    `recovery_sync_state` but never become suggestions. Where do unmatched
    candidates wait, and how does a later athlete-match backfill them?
11. **Graph materialization (L3).** Plain views, materialized views refreshed by
    `pg_cron`, or app-computed? Defer until P5, but the choice affects whether
    observations need additional indexes.
12. **Dev-bypass parity.** The whole app branches on `DEV_AUTH_BYPASS` with local
    JSON stores. The Observation Store needs a `dev-observation-store` equivalent
    or the bypass mode diverges from prod. Non-trivial surface; scope it into P1.

---

## 13. What we should explicitly NOT build

Per principle #12 and your objective #4 — call out duplication before it happens:

- **A second ingestion subsystem for connectors.** The synthetic-`message_ingest`
  funnel already unifies connectors with messages. Do **not** give the
  Observation Store its own connector intake.
- **A new approval queue.** `suggested_actions` + `reviewSuggestionAction` is the
  gate. The store consumes its output; it does not re-implement review.
- **An AI write path.** No "AI auto-commits high-confidence observations." AI
  stays L1. (This is the single most important thing to *not* build.)
- **A bespoke per-signal write branch** in the approval gate for each new metric.
  That's the current pain; `commitObservations()` + the registry replaces it.
- **A separate cost/usage system for new AI features.** `ai_usage` + the daily cap
  already exist; every AI call reuses them.

---

## 14. Summary

The L2 Spine is a **thin, additive canonical layer**, not a rewrite. It reuses the
ingestion pipeline, the connector framework (generalized), the AI fences, and the
approval gate **unchanged in spirit**, and gives them a single destination:
immutable, idempotent, coach-approved **observations** that become the source of
truth and the substrate for the Athlete Intelligence Graph. The only genuinely
risky step (P4: making observations canonical) is isolated, evidence-gated, and
reversible. Everything before it ships dark.

The three foundational decisions are now settled (§0.1: D1 coexist, D2 default
coach approval, D3 one-row-per-metric + `reading_group_id`). **Next step:** clear
the Implementation Readiness Checklist (§15) before any P1 schema is drafted.

---

## 15. Implementation Readiness Checklist

Implementation does **not** begin until every item below is checked. This is the
gate between "RFC" and "P1 migration." Nothing here is code — it is the set of
agreements and reviews that must exist first.

| # | Prerequisite | Done when… | Owner |
|---|---|---|---|
| 1 | **RFC approved** | This document is reviewed and signed off; D1–D3 accepted as binding. | Lead Architect + stakeholder |
| 2 | **Metric Registry finalized (P0)** | The canonical metric set (key, domain, unit, kind, range, projection target) is enumerated and agreed; adding a metric is a known, documented step. | Architect |
| 3 | **Observation schema finalized** | `observations` columns, enums, idempotency index `(coach_id, source, source_ref)`, and `reading_group_id` semantics are frozen; superseding/`observations_current` view defined. | Architect + DB review |
| 4 | **Connector contracts frozen** | `ObservationConnector` / `ObservationSample` shapes agreed; `RecoverySample` mapping confirmed back-compatible; `ingest_sync_state` generalization signed off. | Architect |
| 5 | **AI interfaces frozen** | L1 normalize/route interfaces defined behind the existing provider/`call.ts` fences; `AI_ENABLED` default-off, daily cap, and `ai_usage` reuse confirmed; deterministic fallback contract restated (`null` → deterministic). | Architect |
| 6 | **Migration review complete** | Each planned migration is additive, RLS-complete, idempotency-indexed, and reviewed against the schema-first rule; no destructive change in any behavior-adding migration. | DB reviewer |
| 7 | **Rollback strategy documented** | Per-phase revert is written down: P1–P3 = flag off / drop new table; P4 = revert reads to retained domain tables; backfill is idempotent and re-runnable. Every phase has a tested "undo." | Architect + Ops |
| 8 | **Performance expectations defined** | Expected row volume per athlete-day, index plan for `(client_id, metric, observed_at)` and `reading_group_id`, and `observations_current` read cost are estimated; dev-bypass store parity scoped. | Architect + DB |
| 9 | **Security review complete** | RLS policies for `observations` (+ any new table) mirror coach-scoping via `current_profile_id()`; service-role confined to bridge/cron; `sensitive` handling for labs/injury confirmed; no PII broadening. | Security reviewer |
| 10 | **Process agreements restated** | Small reviewable PRs, no merge without approval, schema-first migrations, full tests, and production verification after every deploy — confirmed as the working agreement for all phases. | Team |

When all ten are checked, P1 may begin — schema first, behind a flag, dual-writing
beside the existing source of truth.
