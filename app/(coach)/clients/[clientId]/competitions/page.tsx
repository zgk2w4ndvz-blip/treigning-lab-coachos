import Link from "next/link"
import { Trophy, Plus } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getClientCompetitionEvents } from "@/lib/data/competitions"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { CompetitionEventCard } from "@/components/competitions/competition-event-card"

export default async function ClientCompetitionsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const events = await getClientCompetitionEvents(clientId)

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No upcoming competitions"
        description="Plan a weight cut to track competition prep, weigh-in, hydration, and fueling."
        action={
          <Button asChild>
            <Link href={`/clients/${clientId}/combat/new`}>
              <Plus className="size-4" />
              Plan a cut
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {events.map((event) => (
        <CompetitionEventCard key={`${event.source}-${event.id}`} event={event} />
      ))}
    </div>
  )
}
