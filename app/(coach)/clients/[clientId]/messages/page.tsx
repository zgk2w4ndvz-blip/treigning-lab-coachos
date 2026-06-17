import { MessageSquare } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getClientMessages } from "@/lib/data/client-messages"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import type { MessageIngest, MessageSource } from "@/types/models"

const SOURCE_LABEL: Record<MessageSource, string> = {
  imessage: "iMessage",
  sms: "SMS",
  whatsapp: "WhatsApp",
  gmail: "Gmail",
  manual: "Manual",
  csv: "CSV",
  json: "JSON",
}

function dayKey(m: MessageIngest): string {
  return (m.received_at ?? m.created_at).slice(0, 10)
}

function time(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function Bubble({ m }: { m: MessageIngest }) {
  const outbound = m.direction === "outgoing"
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[78%] space-y-1", outbound && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-wrap",
            outbound
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          )}
        >
          {m.body}
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <span>{outbound ? "Coach" : "Athlete"}</span>
          <span>·</span>
          <span>{time(m.received_at ?? m.created_at)}</span>
          <span>·</span>
          <span>{SOURCE_LABEL[m.source]}</span>
        </div>
      </div>
    </div>
  )
}

export default async function ClientMessagesPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const messages = await getClientMessages(clientId)

  // Group into day sections (messages are already oldest → newest).
  const days: { key: string; items: MessageIngest[] }[] = []
  for (const m of messages) {
    const key = dayKey(m)
    const last = days[days.length - 1]
    if (last && last.key === key) last.items.push(m)
    else days.push({ key, items: [m] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Conversation</h2>
          <p className="text-muted-foreground text-sm">
            Communication history for this athlete (read-only).
          </p>
        </div>
        {messages.length > 0 ? (
          <Badge variant="secondary">
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description={
            DEV_AUTH_BYPASS
              ? "Message history appears here in live mode (sourced from the message inbox)."
              : "Messages ingested for this athlete will appear here as a conversation."
          }
          className="py-12"
        />
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.key} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs font-medium">
                  {formatDate(day.key)}
                </span>
                <div className="bg-border h-px flex-1" />
              </div>
              <div className="space-y-2">
                {day.items.map((m) => (
                  <Bubble key={m.id} m={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
