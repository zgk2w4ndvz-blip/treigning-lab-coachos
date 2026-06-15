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
  labs: "Labs", training: "Training",
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

  function review(item: ReviewQueueItem, decision: "approve" | "reject") {
    const editedProtocol =
      edits[item.id] != null && edits[item.id].trim() !== item.suggestedProtocol
        ? edits[item.id]
        : undefined
    const nextStatus = decision === "reject" ? "rejected" : editedProtocol ? "edited" : "approved"
    setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: nextStatus } : r)))
    start(async () => {
      const res = await reviewSuggestionAction(item.id, decision, editedProtocol)
      if (res.ok) toast.success(decision === "reject" ? "Rejected" : "Approved → prescription created")
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
