import { notFound } from "next/navigation"

import { getClientSnapshot } from "@/lib/data/clients"
import { getClientTimeline } from "@/lib/data/client-timeline"
import { fullName } from "@/lib/utils/format"
import { ClientStory } from "@/components/coach/client-story"

// Story — a trend header + a context-rich, merged timeline assembled from the
// EXISTING per-domain readers (weight, body comp, recovery, nutrition, training,
// messages, competitions, alerts, notes). Read-only. Does NOT read the
// observations table.
export default async function ClientStoryPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const [snap, timeline] = await Promise.all([
    getClientSnapshot(clientId),
    getClientTimeline(clientId),
  ])
  if (!snap) notFound()

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
      trends={timeline.trends}
      events={timeline.events.slice(0, 30)}
    />
  )
}
