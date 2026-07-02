"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, X, ShieldAlert, UserX, Inbox, Link2, ArrowDownRight } from "lucide-react"

import { reviewSuggestionAction } from "@/lib/actions/inbox"
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
  ConfidenceMeter,
  confidenceTier,
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

/** Plain-language summary of what approving this suggestion writes. */
function whatApprovalWrites(item: ReviewQueueItem): string {
  const action = (item.details as Details)?.action
  if (action === "create_weight_log") return "writes weight log entries"
  if (action === "body_composition_update") return "updates body-composition fields"
  if (action === "recovery_import") return "writes a recovery log"
  return "creates a prescription + coach task"
}

/** One suggested action inside a message card — keeps its own approve/deny. */
function ActionBlock({
  item,
  unmatched,
  onEdit,
  onReview,
}: {
  item: ReviewQueueItem
  unmatched: boolean
  onEdit: (id: string, v: string) => void
  onReview: (item: ReviewQueueItem, decision: "approve" | "reject") => void
}) {
  const done = item.status !== "pending"
  const bc = bodyCompRows(item.details)
  const nutr = nutritionRows(item.details)
  const lb = lowBaseInfo(item.details)
  const coach = isCoachRx(item.details)
  const banner = coach ? "Coach prescription detected" : bc ? "Athlete update detected" : null

  return (
    <div className="rounded-control border border-ds-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{DOMAIN_LABELS[item.domain]}</Badge>
        {item.sensitive ? (
          <Badge tone="warning">
            <ShieldAlert className="size-3" /> Sensitive — manual review
          </Badge>
        ) : null}
        <ConfidenceMeter value={item.confidence} />
        {item.intent ? <span className="text-xs text-ds-text-secondary">· {item.intent}</span> : null}
        {done ? <Badge tone="neutral">{item.status}</Badge> : null}
      </div>

      {!done && confidenceTier(item.confidence) === "low" ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-control bg-ds-warning-bg px-2 py-1 text-[11px] text-ds-warning-on">
          <ShieldAlert className="size-3.5 shrink-0" /> Low confidence — check this against the message before approving.
        </p>
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

      <p className="mt-2 flex items-center gap-1.5 text-xs text-ds-text-muted">
        <ArrowDownRight className="size-3.5" /> On approve → {whatApprovalWrites(item)}
      </p>

      {!done ? (
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onReview(item, "reject")}>
            <X className="size-4" /> Reject
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onReview(item, "approve")}
            disabled={unmatched}
            title={unmatched ? "Match an athlete first" : undefined}
          >
            <Check className="size-4" /> Approve
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function InboxQueue({ items }: { items: ReviewQueueItem[] }) {
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

  function review(item: ReviewQueueItem, decision: "approve" | "reject") {
    const editedProtocol =
      edits[item.id] != null && edits[item.id].trim() !== item.suggestedProtocol
        ? edits[item.id]
        : undefined
    const nextStatus = decision === "reject" ? "rejected" : editedProtocol ? "edited" : "approved"
    setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: nextStatus } : r)))
    start(async () => {
      const res = await reviewSuggestionAction(item.id, decision, editedProtocol)
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
