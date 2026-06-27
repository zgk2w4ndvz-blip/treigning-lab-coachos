# CoachOS Design System — "Performance Lab" (dark)

> **Status:** DESIGN EXPLORATION — not yet implemented. This is the visual/UX
> source of truth for the CoachOS UI overhaul. It keeps the **existing dark color
> scheme** and only sharpens layout, hierarchy, spacing, typography, components,
> and motion. Companion: the redesigned Command Center / Inbox mockups.
> Implementation is tracked separately (phases U0–U4) and is **not** started.

Aesthetic: premium performance-lab — calm, high-contrast, data-first. Feels like
an instrument, not an admin tool. Apple / WHOOP / Vercel / Linear lineage.

Principles: one primary action per screen · 8px grid · generous whitespace ·
subtle motion · color encodes meaning (never decoration) · two type weights only ·
sentence case everywhere.

---

## 1. Color tokens (unchanged scheme)

### Surfaces
| Token | Hex | Use |
|---|---|---|
| `--surface-page` | `#0a0b0e` | app canvas |
| `--surface-sidebar` | `#0c0d11` | left nav |
| `--surface-1` | `#15171c` | cards / panels |
| `--surface-2` | `#1b1e24` | hover / elevated / inputs |
| `--border` | `#23262e` | hairlines |
| `--border-strong` | `#2c3038` | emphasis / hover border |

### Text
| Token | Hex |
|---|---|
| `--text-primary` | `#e8eaed` |
| `--text-secondary` | `#9aa0aa` |
| `--text-muted` | `#6b7280` |

### Semantic roles — each role = solid / tint-bg / on-tint text
| Role | Solid | Hover | Tint bg | On-tint text | Meaning |
|---|---|---|---|---|---|
| Primary (blue) | `#3b82f6` | `#60a5fa` | `#16273f` | `#7fb0ec` | interactive, links, selected |
| Positive (green) | `#22c55e` | `#16a34a` | `#14271c` | `#7fd99a` | on-track, good |
| Warning (amber) | `#f59e0b` | `#d97706` | `#2a2110` | `#f5b14a` | off-track, medium |
| Attention (purple) | `#a855f7` | `#9333ea` | `#241733` | `#c79bf0` | needs review |
| Danger (red) | `#ef4444` | `#dc2626` | `#2a1416` | `#f08a8a` | critical |

Rule: a colored chip/pill uses `tint bg` + `on-tint text` from the **same** family —
never plain white/gray text on a tint, never a saturated solid behind body text.

---

## 2. Spacing · radius · type · motion

**Spacing** — 8px base scale: `4 · 8 · 12 · 16 · 24 · 32`.
Card padding 16 · KPI card 14 · list row 8–10 · section gap 12–16.

**Radius** — control `9px` · card `12px` · app frame `16px` · pill `999px`.
Never round a single-sided (`border-left`/`-top`) accent.

**Type** — Inter / system sans. Two weights only: **400** regular, **500** medium.
| Role | Size / weight |
|---|---|
| Page title | 21 / 500 |
| Section header | 14 / 500 |
| Body | 13 / 400 |
| Meta / label | 12 / 400 |
| Micro | 11 / 400 |

Sentence case everywhere (no Title Case, no ALL CAPS — wordmark excepted).

**Motion** — micro-interactions `120ms ease-out` (hover, toggle, chip) · panels /
drawers `200ms ease-out` · active press `scale(0.98)`. Subtle, no bounce/overshoot.

---

## 3. Component library

| Component | Spec |
|---|---|
| **KPI card** | `surface-1`, 12px radius, 14px pad. Label `12/muted` + trailing role icon → value `28/500` → delta chip (role `↑/↓`) + role-colored sparkline (1.5px, no axis). |
| **Raised card** | `surface-1` + `border`, 12px radius, 16px pad. Header = `14/500` title + optional right control / link. |
| **Sidebar item** | 36px row, 18px icon + `13` label. Selected = primary `tint-bg` fill + `text-primary`. Hover = `surface-2`. Inbox badge = primary tint pill. |
| **Button** | Primary: filled `#3b82f6`, white text — **one per view**. Secondary: transparent + `border-strong`, hover `surface-2`. Ghost: text only. All 9px radius, `13/500`, press `scale(.98)`. |
| **Badge / chip** | pill, `11/500`, role `tint-bg` + `on-tint`. Low=danger · Medium=warning · Review=attention · On-track=positive. |
| **List / priority row** | 8–10px pad; avatar 34px + name `13/500` + meta `12/muted` + status chip + muted `chevron-right`. Bordered rows on hover — never nested cards. |
| **Toggle** | 30×17 track; on = `#3b82f6`, off = `border` + muted knob; 120ms. |
| **Cadence selector** | single-select tiles (icon + label); selected = `border primary` + `tint-bg`; idle = `border` + muted. |
| **Chart** | gridlines `#1d2027`, baseline `#262a33`; series 2px role lines (the lowest band dashed so it reads without color); end-point dots; `10px` muted axis labels; legend dots. |
| **Avatar** | 34px circle, `surface-2` bg, initials `12/muted`, or photo. |
| **Toast** | `surface-1` card, role icon, title `13/500` + body `12/muted` + timestamp; slide-in 200ms. |
| **Search field** | `surface-2`, `border`, 9px radius, leading `ti-search`, `⌘K` hint right. |

### States (every interactive element)
default → hover (`surface-2` / `border-strong`) → active (`scale .98`) → focus
(`0 0 0 2px` primary ring) → disabled (40% muted, color removed). Avoid disabled
buttons; keep enabled and respond on use.

---

## 4. Notification system

Two-axis model:

1. **Cadence** (single-select): Instant (real-time) · Hourly · Every 2h · Every 4h ·
   Daily digest. Controls how non-critical events are batched.
2. **Event types** (independent toggles): new inbound messages · AI suggestions
   ready for approval · approvals completed · critical athlete alerts · system sync
   issues (optional).

**Critical alerts always bypass cadence** (always Instant), regardless of the
chosen digest: recovery score < 40 · HRV down > 20% · hydration < 50% · missed 2+
training sessions. Surfaced as its own clearly-labeled section so the coach sees
what can interrupt them.

Delivery surfaces: in-app toast (real-time), the Inbox badge/count, and a digest
card ("5 new suggestions, 8 new messages"). Coach configures all of it from the
Inbox notification panel (right rail on Command Center, full page in Settings).

---

## 5. Screen inventory (design scope)

Command Center (done) · Inbox / approval queue · Athlete Profile · Athlete List ·
Calendar / Schedule · Settings. Plus the component library and interaction/motion
guidelines above.

---

## 6. Implementation (not started — gated like L2)

Translating to the real Next.js / Tailwind / shadcn-Radix app, small reviewable
PRs, no merge without approval, **zero backend / L2 changes**, functionality
identical, visual verification + screenshot per step:

| Phase | Deliverable |
|---|---|
| **U0** | Design tokens → Tailwind theme + CSS vars. Invisible; tokens available. |
| **U1** | Primitive components (card, button, badge, KPI, toggle, chip) on tokens. |
| **U2** | Command Center rebuilt on the new primitives (flagship). |
| **U3** | One screen per PR: Inbox → Athlete Profile → Athlete List → Calendar → Settings. |
| **U4** | Notification system UI + preference persistence. |

U0→U1 ship first (invisible, de-risk everything after). Each phase is independently
deployable and reversible. No production code until the design is approved.
