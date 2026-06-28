"use client"

import { useState } from "react"
import { Activity, CalendarClock, CalendarDays } from "lucide-react"

import { Card, SectionHeader, Badge } from "@/components/ds"

const CADENCES = [
  { value: "instant", label: "Instant", icon: Activity },
  { value: "hourly", label: "Hourly", icon: CalendarClock },
  { value: "2h", label: "Every 2h", icon: CalendarClock },
  { value: "4h", label: "Every 4h", icon: CalendarClock },
  { value: "daily", label: "Daily digest", icon: CalendarDays },
] as const

const EVENTS = [
  { key: "messages", label: "New inbound messages", def: true },
  { key: "suggestions", label: "AI suggestions ready", def: true },
  { key: "approvals", label: "Approvals completed", def: true },
  { key: "critical", label: "Critical athlete alerts", def: true },
  { key: "sync", label: "System sync issues", def: false },
]

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[18px] w-[32px] rounded-pill transition-colors ${on ? "bg-ds-primary" : "bg-ds-surface-2"}`}
    >
      <span
        className={`absolute top-[2px] size-[14px] rounded-full bg-white transition-all ${on ? "left-[16px]" : "left-[2px]"}`}
      />
    </button>
  )
}

// Notification preferences (U4) — DISPLAY-ONLY preview. There is no notification
// backend yet, so nothing is persisted; the banner makes that explicit. No writes.
export function NotificationPrefs() {
  const [cadence, setCadence] = useState<string>("instant")
  const [events, setEvents] = useState<Record<string, boolean>>(
    () => Object.fromEntries(EVENTS.map((e) => [e.key, e.def]))
  )

  return (
    <Card>
      <SectionHeader
        title="Notification cadence"
        action={<Badge tone="warning">Preview</Badge>}
        description="How and how often messages and suggestions reach you. Saving isn't wired yet — these controls are a preview."
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CADENCES.map((c) => {
          const Icon = c.icon
          const active = cadence === c.value
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={active}
              onClick={() => setCadence(c.value)}
              className={`flex flex-col items-center gap-1 rounded-control border px-2 py-2.5 text-center transition-colors ${
                active
                  ? "border-ds-primary bg-ds-primary-bg text-ds-primary-on"
                  : "border-ds-border text-ds-text-secondary hover:bg-ds-surface-2"
              }`}
            >
              <Icon className="size-4" />
              <span className="text-[11px]">{c.label}</span>
            </button>
          )
        })}
      </div>

      <div className="divide-y divide-ds-border">
        {EVENTS.map((e) => (
          <div key={e.key} className="flex items-center justify-between py-2.5">
            <span className="text-[0.8125rem] text-ds-text-primary">{e.label}</span>
            <Toggle
              on={!!events[e.key]}
              label={e.label}
              onClick={() => setEvents((p) => ({ ...p, [e.key]: !p[e.key] }))}
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-ds-text-muted">
        Critical athlete alerts always notify instantly, regardless of cadence.
      </p>
    </Card>
  )
}
