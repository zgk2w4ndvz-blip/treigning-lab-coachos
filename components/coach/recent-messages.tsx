import { MessageSquare, Mail, Phone, MessageCircle, FileText } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { AlertCard } from "@/components/shared/alert-card"
import { ActionRow } from "@/components/shared/action-row"
import { timeAgo } from "@/lib/utils/format"
import type { ReviewQueueItem, MessageSource } from "@/types/models"

const sourceIcon: Partial<Record<MessageSource, LucideIcon>> = {
  gmail: Mail,
  sms: Phone,
  imessage: MessageCircle,
  whatsapp: MessageCircle,
  manual: FileText,
}

/**
 * Recent ingested athlete messages, derived (read-only) from the inbox review
 * queue. No new data source — same `getInbox()` items the Inbox page uses.
 */
export function RecentMessages({ items }: { items: ReviewQueueItem[] }) {
  const recent = [...items]
    .sort(
      (a, b) =>
        new Date(b.receivedAt ?? b.createdAt).getTime() -
        new Date(a.receivedAt ?? a.createdAt).getTime()
    )
    .slice(0, 6)

  return (
    <AlertCard
      title="Recent messages"
      icon={MessageSquare}
      viewAllHref="/inbox"
      isEmpty={recent.length === 0}
      emptyTitle="No recent messages"
      emptyDescription="Ingested athlete messages will appear here."
    >
      {recent.map((item) => {
        const Icon = sourceIcon[item.source] ?? MessageSquare
        const who = item.athleteName ?? item.senderLabel ?? "Unknown sender"
        return (
          <ActionRow
            key={item.id}
            leading={
              <div className="bg-muted text-muted-foreground rounded-md p-1.5">
                <Icon className="size-3.5" />
              </div>
            }
            title={who}
            titleHref={
              item.clientId ? `/clients/${item.clientId}/messages` : "/inbox"
            }
            subtitle={item.messageSnippet}
            meta={timeAgo(item.receivedAt ?? item.createdAt)}
          />
        )
      })}
    </AlertCard>
  )
}
