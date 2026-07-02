"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, X, ShieldAlert, UserX, Inbox, Link2, ArrowDownRight, Pencil, Info } from "lucide-react"

import { reviewSuggestionAction, type ReviewEdits } from "@/lib/actions/inbox"
import { groupByMessage } from "@/lib/messages/group-inbox"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  Badge,
  Chip,
  Button,
  StatusDot,
  EmptyState,
} from "@/components/ds"
import type { ReviewQueueItem, SuggestionDomain } from "@/types/models"

const DOMAIN_LABELS: Record<SuggestionDomain, string> = {
  diet: "Diet", supplementation: "Supplementation", altolab: "AltoLab",
  low_base: "Low base", hydration: "Hydration", recovery: "Recovery",
  labs: "Labs", training: "Training", body_composition: "Body Composition",
}

const BODY_COMP_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "body_fat_percentage", label: "PBF", unit: "%" },
  { key: "skeletal_muscle_mass_lbs", label: "SMM", unit: " lb" },
  { key: "body_fat_mass_lbs", label: "Body Fat Mass", unit: " lb" },
  { key: "total_body_water_lbs", label: "Total Body Water", unit: " lb" },
  { key: "bmr", label: "BMR", unit: " kcal" },
]

type Details = Record<string, unknown> | null | undefined
const num = (d: Details, k: string): number | null => (d && typeof d[k] === "number" ? (d[k] as number) : null)

/** Structured rows for a body_composition_update suggestion, or null. */
function bodyCompRows(details: Details) {
  if (!details || details.action !== "body_composition_update") return null
  const rows = BODY_COMP_FIELDS.filter((f) => typeof details[f.key] === "number").map((f) => ({
    label: f.label,
    value: `${details[f.key] as number}${f.unit}`,
  }))
  return rows.length ? rows : null
}

const NUTRITION_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
]

/** Structured rows for a nutrition_prescription suggestion, or null. */
function nutritionRows(details: Details) {
  if (!details || details.action !== "nutrition_prescription") return null
  const rows = NUTRITION_FIELDS.filter((f) => typeof details[f.key] === "number").map((f) => ({
    label: f.label,
    value: `${details[f.key] as number}${f.unit}`,
  }))
  return rows.length ? rows : null
}

/** Low Base dose summary for a low_base_prescription suggestion, or null. */
function lowBaseInfo(details: Details) {
  if (!details || details.action !== "low_base_prescription") return null
  const mins = num(details, "minutes_per_session")
  const freq = num(details, "frequency_per_week")
  if (mins == null && freq == null) return null
  return { mins, freq, weekly: mins != null && freq != null ? mins * freq : null }
}

const isCoachRx = (details: Details) => !!details && details.author_type === "coach"

/** Deterministic "why the system read it this way". Prefers a stored reason
 *  (from the extractor), else falls back to a domain/action explanation.
 *  No AI call — this is either recorded rationale or a rule description. */
function explainDetails(item: ReviewQueueItem, d: Details): string {
  const reason = (d as { reason?: unknown } | null)?.reason
  if (typeof reason === "string" && reason.trim()) return reason
  const action = (d as { action?: string; kind?: string } | null)?.action ?? (d as { kind?: string } | null)?.kind
  if (action === "create_weight_log") return "Number(s) in body-weight range with a weight/time-of-day cue."
  if (action === "body_composition_update") return "Labeled body-composition fields (PBF/SMM/…) were present."
  if (action === "nutrition_prescription") return "Calorie/macro targets were detected in the message."
  if (action === "competition_event") return "Competition/tournament language with a date cue."
  if (action === "travel_event") return "Travel language with a date cue."
  return `Keyword match for the ${DOMAIN_LABELS[item.domain]} domain.`
}

/** Live preview of the exact write on approval, reflecting current edits. */
function previewWrite(d: Details, clientName: string, dateLabel: string): string {
  const action = (d as { action?: string; kind?: string } | null)?.action ?? (d as { kind?: string } | null)?.kind
  if (action === "create_weight_log") {
    const entries = (d as { entries?: { label?: string; weightLbs?: number }[] }).entries ?? []
    const parts = entries.map((e) => `${e.weightLbs} lb${e.label && e.label !== "general" ? ` (${e.label})` : ""}`)
    return `weight_logs → ${parts.join(", ") || "—"} for ${clientName} on ${dateLabel}`
  }
  if (action === "body_composition_update") {
    const bc = bodyCompRows(d) ?? []
    return `weight_logs (body-comp) → ${bc.map((r) => `${r.label} ${r.value}`).join(", ")} for ${clientName}`
  }
  if (action === "nutrition_prescription") {
    const nutr = nutritionRows(d) ?? []
    return `nutrition_plan → ${nutr.map((r) => `${r.label} ${r.value}`).join(", ")} for ${clientName}`
  }
  if (action === "competition_event" || action === "travel_event") {
    const when = (d as { when?: string | null }).when
    return `coach task → schedule ${action === "travel_event" ? "travel" : "competition"}${when ? ` (${when})` : ""} for ${clientName} — no calendar event is created automatically`
  }
  return `prescription + coach task for ${clientName}`
}

export type RosterOption = { id: string; name: string }

// Approve-time "type" the coach can correct a suggestion to. "note" leaves the
// structured payload untouched (a plain prescription/notes approval).
const TYPE_OPTIONS: { value: string; label: string; unit: string }[] = [
  { value: "create_weight_log", label: "Body weight", unit: "lb" },
  { value: "body_composition_update", label: "Body fat %", unit: "%" },
  { value: "nutrition_prescription", label: "Calories", unit: "kcal" },
  { value: "note", label: "Note / prescription", unit: "" },
]
const KNOWN_ACTIONS = new Set(TYPE_OPTIONS.map((t) => t.value).filter((v) => v !== "note"))

/** The current structured action of a suggestion, or "note" if none. */
function currentAction(d: Details): string {
  const a = (d as { action?: string } | null | undefined)?.action
  return typeof a === "string" && KNOWN_ACTIONS.has(a) ? a : "note"
}
/** The primary editable numeric value for the current structured action. */
function primaryValue(d: Details): string {
  if (!d) return ""
  const a = (d as { action?: string }).action
  if (a === "create_weight_log") {
    const e = (d as { entries?: { weightLbs?: number }[] }).entries?.[0]
    return e?.weightLbs != null ? String(e.weightLbs) : ""
  }
  if (a === "body_composition_update") {
    const v = (d as { body_fat_percentage?: number }).body_fat_percentage
    return v != null ? String(v) : ""
  }
  if (a === "nutrition_prescription") {
    const v = (d as { calories?: number }).calories
    return v != null ? String(v) : ""
  }
  return ""
}

const fieldCls =
  "border-ds-border bg-ds-surface-1 h-8 rounded-control border px-2 text-sm text-ds-text-primary"

/** One suggested action inside a message card — keeps its own approve/deny. */
function ActionBlock({
  item,
  unmatched,
  roster,
  onEdit,
  onReview,
}: {
  item: ReviewQueueItem
  unmatched: boolean
  roster: RosterOption[]
  onEdit: (id: string, v: string) => void
  onReview: (item: ReviewQueueItem, decision: "approve" | "reject", edits?: ReviewEdits) => void
}) {
  const done = item.status !== "pending"
  const bc = bodyCompRows(item.details)
  const nutr = nutritionRows(item.details)
  const lb = lowBaseInfo(item.details)
  const coach = isCoachRx(item.details)
  const banner = coach ? "Coach prescription detected" : bc ? "Athlete update detected" : null

  // ── Approve-time edit panel state ──────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [type, setType] = useState(() => currentAction(item.details))
  const [value, setValue] = useState(() => primaryValue(item.details))
  const [unit, setUnit] = useState("lb")
  const [clientId, setClientId] = useState(item.clientId ?? "")
  const [logDate, setLogDate] = useState("")
  const typeMeta = TYPE_OPTIONS.find((t) => t.value === type)

  function buildEdits(): ReviewEdits {
    const edits: ReviewEdits = {}
    if (clientId && clientId !== item.clientId) edits.clientId = clientId
    if (logDate) edits.loggedDate = logDate
    const v = parseFloat(value)
    if (type !== "note" && Number.isFinite(v)) {
      if (type === "create_weight_log") {
        const lbs = unit === "kg" ? Math.round(v * 2.20462 * 10) / 10 : v
        edits.details = { action: "create_weight_log", context: "body", entries: [{ label: "general", weightLbs: lbs }] }
      } else if (type === "body_composition_update") {
        edits.details = { action: "body_composition_update", body_fat_percentage: v }
      } else if (type === "nutrition_prescription") {
        edits.details = { action: "nutrition_prescription", calories: v }
      }
    }
    return edits
  }

  // Approve enabled when the item is matched OR the coach assigned an athlete.
  const canApprove = !unmatched || !!clientId

  // Effective (live) view of the suggestion, reflecting any open-panel edits —
  // drives the reasoning + write preview so the coach sees exactly what lands.
  const liveEdits = editOpen ? buildEdits() : {}
  const effDetails = (liveEdits.details ?? item.details) as Details
  const effClientName =
    (clientId ? roster.find((r) => r.id === clientId)?.name : null) ?? item.athleteName ?? "the athlete"
  const effDate = logDate || "the message date"
  const why = explainDetails(item, effDetails)
  const preview = previewWrite(effDetails, effClientName, effDate)

  return (
    <div className="rounded-control border border-ds-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{DOMAIN_LABELS[item.domain]}</Badge>
        {item.sensitive ? (
          <Badge tone="warning">
            <ShieldAlert className="size-3" /> Sensitive — manual review
          </Badge>
        ) : null}
        <span className="text-xs text-ds-text-muted">conf {Math.round(item.confidence * 100)}%</span>
        {item.intent ? <span className="text-xs text-ds-text-secondary">· {item.intent}</span> : null}
        {done ? <Badge tone="neutral">{item.status}</Badge> : null}
        {!done ? (
          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-ds-text-secondary hover:text-ds-text-primary"
          >
            <Pencil className="size-3.5" /> {editOpen ? "Close edit" : "Edit"}
          </button>
        ) : null}
      </div>

      {editOpen && !done ? (
        <div className="mt-2 grid gap-2 rounded-control border border-ds-border bg-ds-surface-2 p-3">
          <p className="text-[11px] font-medium text-ds-text-muted">Correct before approving</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] text-ds-text-muted">
              Type
              <select className={fieldCls} value={type} onChange={(e) => setType(e.target.value)}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-ds-text-muted">
              Athlete
              <select className={fieldCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— unassigned —</option>
                {roster.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            {type !== "note" ? (
              <label className="grid gap-1 text-[11px] text-ds-text-muted">
                Value
                <div className="flex gap-1">
                  <input
                    type="number" inputMode="decimal" step="0.1" value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={cn(fieldCls, "w-full")}
                  />
                  {type === "create_weight_log" ? (
                    <select className={fieldCls} value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                    </select>
                  ) : (
                    <span className="flex items-center px-1 text-xs text-ds-text-muted">{typeMeta?.unit}</span>
                  )}
                </div>
              </label>
            ) : null}
            <label className="grid gap-1 text-[11px] text-ds-text-muted">
              Date (optional)
              <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className={fieldCls} />
            </label>
          </div>
        </div>
      ) : null}

      {bc || nutr || lb ? (
        <div className="mt-2 rounded-control bg-ds-surface-2 p-3">
          {banner ? (
            <p className="mb-2 text-[11px] font-medium text-ds-text-muted">{banner}</p>
          ) : null}
          {bc ? (
            <>
              <p className="mb-1.5 text-sm font-medium text-ds-text-primary">Body composition update</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {bc.map((r) => (
                  <li key={r.label} className="flex justify-between gap-2">
                    <span className="text-ds-text-muted">{r.label}</span>
                    <span className="font-medium tabular-nums text-ds-text-primary">{r.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {nutr ? (
            <>
              <p className="mb-1.5 text-sm font-medium text-ds-text-primary">Nutrition prescription</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {nutr.map((r) => (
                  <li key={r.label} className="flex justify-between gap-2">
                    <span className="text-ds-text-muted">{r.label}</span>
                    <span className="font-medium tabular-nums text-ds-text-primary">{r.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {lb ? (
            <>
              <p className="mb-1.5 text-sm font-medium text-ds-text-primary">Low base prescription</p>
              <ul className="space-y-1 text-sm text-ds-text-primary">
                {lb.mins != null ? <li className="tabular-nums">{lb.mins} minutes/session</li> : null}
                {lb.freq != null ? <li className="tabular-nums">{lb.freq}× per week</li> : null}
                {lb.weekly != null ? (
                  <li className="pt-1 text-ds-text-muted">
                    Total weekly time:{" "}
                    <span className="font-medium tabular-nums text-ds-text-primary">{lb.weekly} min/week</span>
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-ds-text-muted">Suggested protocol (editable)</p>
          <Textarea
            defaultValue={item.suggestedProtocol}
            onChange={(e) => onEdit(item.id, e.target.value)}
            rows={2}
            className="text-sm"
            disabled={done}
          />
        </div>
      )}

      <div className="mt-2 space-y-1 rounded-control bg-ds-surface-2 p-2">
        <p className="flex items-start gap-1.5 text-[11px] text-ds-text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span><span className="font-medium">Why:</span> {why}</span>
        </p>
        <p className="flex items-start gap-1.5 text-[11px] text-ds-text-secondary">
          <ArrowDownRight className="mt-0.5 size-3.5 shrink-0" />
          <span><span className="font-medium">On approve:</span> {preview}</span>
        </p>
      </div>

      {!done ? (
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onReview(item, "reject")}>
            <X className="size-4" /> Reject
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onReview(item, "approve", buildEdits())}
            disabled={!canApprove}
            title={!canApprove ? "Match or assign an athlete first" : undefined}
          >
            <Check className="size-4" /> Approve
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function InboxQueue({ items, roster = [] }: { items: ReviewQueueItem[]; roster?: RosterOption[] }) {
  const [rows, setRows] = useState(items)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [show, setShow] = useState<"pending" | "all">("pending")
  const [sensitiveOnly, setSensitiveOnly] = useState(false)
  const [, start] = useTransition()

  useEffect(() => setRows(items), [items])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (show === "pending" && r.status !== "pending") return false
        if (sensitiveOnly && !r.sensitive) return false
        return true
      }),
    [rows, show, sensitiveOnly]
  )

  // Collapse each source message's actions into one card.
  const groups = useMemo(() => groupByMessage(filtered), [filtered])

  function review(item: ReviewQueueItem, decision: "approve" | "reject", structEdits?: ReviewEdits) {
    const editedProtocol =
      edits[item.id] != null && edits[item.id].trim() !== item.suggestedProtocol
        ? edits[item.id].trim()
        : undefined
    // Merge the free-text protocol edit (notes textarea) with the structured
    // edits from the edit panel. undefined when nothing changed → plain approve.
    const merged: ReviewEdits = { ...structEdits, ...(editedProtocol ? { protocol: editedProtocol } : {}) }
    const hasEdits = Object.keys(merged).length > 0
    const nextStatus = decision === "reject" ? "rejected" : hasEdits ? "edited" : "approved"
    setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: nextStatus } : r)))
    start(async () => {
      const res = await reviewSuggestionAction(item.id, decision, hasEdits ? merged : undefined)
      if (res.ok) toast.success(decision === "reject" ? "Rejected" : "Approved")
      else {
        toast.error(res.error ?? "Failed")
        setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: "pending" } : r)))
      }
    })
  }

  const onEdit = (id: string, v: string) => setEdits((p) => ({ ...p, [id]: v }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={show === "pending"} onClick={() => setShow("pending")}>
          Pending
        </Chip>
        <Chip active={show === "all"} onClick={() => setShow("all")}>
          All statuses
        </Chip>
        <Chip active={sensitiveOnly} onClick={() => setSensitiveOnly((v) => !v)}>
          <ShieldAlert className="size-3.5" /> Sensitive only
        </Chip>
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox />} title="Queue is clear" description="No suggestions match this filter." />
        </Card>
      ) : (
        groups.map((group) => {
          const unmatched = group.matchMethod === "unmatched" || !group.clientId
          return (
            <Card
              key={group.key}
              className={cn(group.sensitive && "border-ds-warning", unmatched && "border-ds-warning")}
            >
              <div className="flex flex-wrap items-center gap-2">
                {group.actions.length > 1 ? (
                  <Badge tone="primary">{group.actions.length} suggested actions</Badge>
                ) : null}
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
                  {unmatched ? (
                    <span className="inline-flex items-center gap-1.5 text-ds-warning-on">
                      <StatusDot status="warning" />
                      <UserX className="size-3.5" /> Unmatched
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-ds-text-secondary">
                      <StatusDot status="positive" />
                      {group.athleteName} · {group.matchMethod} {Math.round(group.matchConfidence * 100)}%
                    </span>
                  )}
                </span>
              </div>

              <p className="mt-2 rounded-control bg-ds-surface-2 p-2 text-sm text-ds-text-primary">
                <span className="mb-0.5 block text-[11px] text-ds-text-muted">
                  {group.source} · {group.senderLabel ?? "unknown sender"}
                </span>
                “{group.messageSnippet}”
              </p>

              {unmatched ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-control bg-ds-warning-bg px-3 py-2">
                  <span className="text-xs text-ds-warning-on">
                    Match this sender to an athlete to enable approval.
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      toast.info("Match this athlete from their record to enable approval.")
                    }
                  >
                    <Link2 className="size-4" /> Match athlete
                  </Button>
                </div>
              ) : null}

              <div className="mt-3 space-y-3">
                {group.actions.map((item) => (
                  <ActionBlock
                    key={item.id}
                    item={item}
                    unmatched={unmatched}
                    roster={roster}
                    onEdit={onEdit}
                    onReview={review}
                  />
                ))}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
