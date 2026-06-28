import { notFound } from "next/navigation"

import { getClientSnapshot } from "@/lib/data/clients"
import { getClientMessages } from "@/lib/data/client-messages"
import { fullName } from "@/lib/utils/format"
import { ClientStory, type StoryEvent } from "@/components/coach/client-story"

// Story (U3) — assembles the athlete's recent record from existing readers
// (snapshot: latest weight/recovery/alerts + recent messages). Read-only. Does NOT
// read the observations table.
export default async function ClientStoryPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const [snap, messages] = await Promise.all([
    getClientSnapshot(clientId),
    getClientMessages(clientId),
  ])
  if (!snap) notFound()

  const events: StoryEvent[] = []

  if (snap.latestWeight) {
    const w = snap.latestWeight
    const bits = [
      w.body_fat_pct != null ? `${w.body_fat_pct}% BF` : null,
      w.skeletal_muscle_mass_lbs != null ? `${w.skeletal_muscle_mass_lbs} lb SMM` : null,
    ].filter(Boolean)
    events.push({
      id: `w-${w.id}`,
      kind: "weight",
      title: `Body weight ${w.weight_lbs} lb`,
      detail: bits.join(" · ") || null,
      source: "body composition",
      at: w.logged_at,
    })
  }

  if (snap.latestRecovery) {
    const r = snap.latestRecovery
    const bits = [
      r.sleep_hours != null ? `Sleep ${r.sleep_hours}h` : null,
      r.energy != null ? `Energy ${r.energy}/10` : null,
      r.soreness != null ? `Soreness ${r.soreness}/10` : null,
    ].filter(Boolean)
    events.push({
      id: `r-${r.id}`,
      kind: "recovery",
      title: "Recovery logged",
      detail: bits.join(" · ") || null,
      source: "recovery",
      at: r.logged_date,
    })
  }

  for (const a of snap.openAlerts) {
    events.push({
      id: `a-${a.id}`,
      kind: "alert",
      title: a.title,
      detail: a.detail,
      source: `alert · ${a.severity}`,
      at: a.created_at,
    })
  }

  for (const m of messages.slice(0, 8)) {
    events.push({
      id: `m-${m.id}`,
      kind: "message",
      title: (m.body ?? "").slice(0, 120) || "Message",
      detail: null,
      source: m.source,
      at: m.received_at ?? m.created_at,
    })
  }

  events.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))

  const name = fullName(snap.client.first_name, snap.client.last_name)

  return (
    <ClientStory
      subtitle={`${name}'s recent record across every source.`}
      nextCompetition={
        snap.nextCompetition
          ? {
              name: snap.nextCompetition.name,
              competition_date: snap.nextCompetition.competition_date,
            }
          : null
      }
      events={events.slice(0, 20)}
    />
  )
}
