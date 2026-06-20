import { ClipboardCheck, ShieldAlert } from "lucide-react"

import { AlertCard } from "@/components/shared/alert-card"
import { ActionRow } from "@/components/shared/action-row"
import { Badge } from "@/components/ui/badge"
import { timeAgo } from "@/lib/utils/format"
import type { ReviewQueueItem, SuggestionDomain } from "@/types/models"

const domainLabel: Record<SuggestionDomain, string> = {
  diet: "Diet",
  supplementation: "Supplements",
  altolab: "AltoLab",
  low_base: "Low Base",
  hydration: "Hydration",
  recovery: "Recovery",
  labs: "Labs",
  training: "Training",
  body_composition: "Body Comp",
}

/**
 * Pending suggested actions awaiting coach review, derived (read-only) from the
 * inbox queue. Links to /inbox to act — no approve/reject logic lives here.
 */
export function PendingApprovals({ items }: { items: ReviewQueueItem[] }) {
  const pending = items.filter((i) => i.status === "pending").slice(0, 6)

  return (
    <AlertCard
      title="Pending approvals"
      icon={ClipboardCheck}
      count={items.filter((i) => i.status === "pending").length}
      viewAllHref="/inbox"
      accent={pending.length > 0 ? "primary" : "default"}
      isEmpty={pending.length === 0}
      emptyTitle="All caught up"
      emptyDescription="No suggested actions are waiting for review."
    >
      {pending.map((item) => (
        <ActionRow
          key={item.id}
          leading={
            <Badge variant="secondary" className="capitalize">
              {domainLabel[item.domain]}
            </Badge>
          }
          title={item.athleteName ?? item.senderLabel ?? "Unmatched"}
          titleHref="/inbox"
          subtitle={item.suggestedProtocol}
          meta={
            <span className="flex items-center gap-1.5">
              {item.sensitive ? (
                <ShieldAlert className="size-3.5 text-red-500" />
              ) : null}
              {timeAgo(item.receivedAt ?? item.createdAt)}
            </span>
          }
        />
      ))}
    </AlertCard>
  )
}
