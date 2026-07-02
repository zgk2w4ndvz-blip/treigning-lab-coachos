import { HeartPulse, Inbox, MessageSquare, Activity } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, SectionHeader, ListRow, Badge } from "@/components/ds"

type Tone = "positive" | "neutral" | "primary"

const CONNECTORS: {
  icon: LucideIcon
  name: string
  desc: string
  status: string
  tone: Tone
}[] = [
  {
    icon: HeartPulse,
    name: "TreigningLab recovery",
    desc: "Local agent · HRV, resting HR, recovery score, hydration",
    status: "Active",
    tone: "positive",
  },
  {
    icon: Inbox,
    name: "Gmail ingestion",
    desc: "Athlete check-in emails → suggested actions",
    status: "Configured via environment",
    tone: "neutral",
  },
  {
    icon: MessageSquare,
    name: "iMessage bridge",
    desc: "Opt-in local Mac agent · reads matched athlete handles only",
    status: "Local",
    tone: "neutral",
  },
  {
    icon: Activity,
    name: "Whoop / Oura",
    desc: "Wearable recovery — connects through the same ingestion pipeline",
    status: "Available",
    tone: "primary",
  },
]

// Connectors panel (U4 polish) — informational. There is no read-API for live
// connector status, so this honestly describes the ingestion sources and their
// configuration model (no fabricated live state, no writes).
export function ConnectorsPanel() {
  return (
    <Card>
      <SectionHeader
        title="Connectors"
        icon={<Activity />}
        description="Sources that feed the coach-approval inbox. Nothing is written without your approval."
      />
      <div className="-mx-2">
        {CONNECTORS.map((c) => {
          const Icon = c.icon
          return (
            <ListRow
              key={c.name}
              leading={
                <span className="flex size-8 items-center justify-center rounded-control bg-ds-surface-2 text-ds-text-secondary">
                  <Icon className="size-4" />
                </span>
              }
              title={c.name}
              subtitle={c.desc}
              trailing={<Badge tone={c.tone}>{c.status}</Badge>}
            />
          )
        })}
      </div>
    </Card>
  )
}
