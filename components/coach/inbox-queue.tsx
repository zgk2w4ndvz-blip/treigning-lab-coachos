"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, X, ShieldAlert, UserX } from "lucide-react"

import { reviewSuggestionAction } from "@/lib/actions/inbox"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { Inbox } from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={show} onValueChange={(v) => setShow(v as "pending" | "all")}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending only</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={sensitiveOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setSensitiveOnly((v) => !v)}
        >
          <ShieldAlert className="size-4" />
          Sensitive only
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="Queue is clear" description="No suggestions match this filter." className="py-10" />
      ) : (
        filtered.map((item) => {
          const done = item.status !== "pending"
          const unmatched = item.matchMethod === "unmatched" || !item.clientId
          return (
            <Card key={item.id} className={cn(item.sensitive && "border-amber-300 dark:border-amber-900/60")}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{DOMAIN_LABELS[item.domain]}</Badge>
                  {item.sensitive ? (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <ShieldAlert className="mr-1 size-3" /> Sensitive — manual review
                    </Badge>
                  ) : null}
                  <span className="text-muted-foreground text-xs">
                    conf {Math.round(item.confidence * 100)}%
                  </span>
                  {done ? (
                    <Badge variant="outline" className="capitalize">{item.status}</Badge>
                  ) : null}
                  <span className="ml-auto text-xs">
                    {unmatched ? (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                        <UserX className="size-3.5" /> Unmatched
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {item.athleteName} · {item.matchMethod} {Math.round(item.matchConfidence * 100)}%
                      </span>
                    )}
                  </span>
                </div>

                <p className="bg-muted/50 rounded p-2 text-sm">
                  <span className="text-muted-foreground text-[11px] block mb-0.5">
                    {item.source} · {item.senderLabel ?? "unknown sender"}
                  </span>
                  “{item.messageSnippet}”
                </p>

                {(() => {
                  const bc = bodyCompRows(item.details)
                  const nutr = nutritionRows(item.details)
                  const lb = lowBaseInfo(item.details)
                  const coach = isCoachRx(item.details)
                  const banner = coach
                    ? "Coach Prescription Detected"
                    : bc
                      ? "Athlete Update Detected"
                      : null

                  if (bc || nutr || lb) {
                    return (
                      <div className="rounded-md border p-3">
                        {banner ? (
                          <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
                            {banner}
                          </p>
                        ) : null}
                        {bc ? (
                          <>
                            <p className="mb-1.5 text-sm font-semibold">Body Composition Update</p>
                            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                              {bc.map((r) => (
                                <li key={r.label} className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">{r.label}</span>
                                  <span className="font-medium tabular-nums">{r.value}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        {nutr ? (
                          <>
                            <p className="mb-1.5 text-sm font-semibold">Nutrition Prescription</p>
                            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                              {nutr.map((r) => (
                                <li key={r.label} className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">{r.label}</span>
                                  <span className="font-medium tabular-nums">{r.value}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        {lb ? (
                          <>
                            <p className="mb-1.5 text-sm font-semibold">Low Base Prescription</p>
                            <ul className="space-y-1 text-sm">
                              {lb.mins != null ? (
                                <li className="tabular-nums">{lb.mins} minutes/session</li>
                              ) : null}
                              {lb.freq != null ? (
                                <li className="tabular-nums">{lb.freq}× per week</li>
                              ) : null}
                              {lb.weekly != null ? (
                                <li className="text-muted-foreground pt-1">
                                  Total Weekly Time:{" "}
                                  <span className="text-foreground font-medium tabular-nums">
                                    {lb.weekly} min/week
                                  </span>
                                </li>
                              ) : null}
                            </ul>
                          </>
                        ) : null}
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">Suggested protocol (editable)</p>
                      <Textarea
                        defaultValue={item.suggestedProtocol}
                        onChange={(e) => setEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                        rows={2}
                        className="text-sm"
                        disabled={done}
                      />
                    </div>
                  )
                })()}

                {!done ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => review(item, "reject")}>
                      <X className="size-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => review(item, "approve")}
                      disabled={unmatched}
                      title={unmatched ? "Match an athlete first" : undefined}
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
