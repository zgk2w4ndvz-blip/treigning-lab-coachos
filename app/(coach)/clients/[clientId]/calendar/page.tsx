import { requireCoach } from "@/lib/auth"
import {
  getAthleteCalendarEvents,
  getAthleteCalendarOverrides,
} from "@/lib/data/athlete-calendar"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { AthleteCalendar } from "@/components/calendar/athlete-calendar"

export default async function ClientCalendarPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const [events, overrides] = await Promise.all([
    getAthleteCalendarEvents(clientId),
    getAthleteCalendarOverrides(clientId),
  ])

  return (
    <div className="space-y-3">
      {DEV_AUTH_BYPASS ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
          Demo calendar (dev bypass) — sample data shown; editing requires the live
          database.
        </p>
      ) : null}
      <AthleteCalendar clientId={clientId} events={events} overrides={overrides} />
    </div>
  )
}
