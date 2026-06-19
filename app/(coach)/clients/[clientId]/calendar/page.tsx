import { requireCoach } from "@/lib/auth"
import {
  getAthleteCalendarEvents,
  getAthleteCalendarOverrides,
} from "@/lib/data/athlete-calendar"
import { getOperatingTimeZone } from "@/lib/data/settings"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { AthleteCalendar } from "@/components/calendar/athlete-calendar"

export default async function ClientCalendarPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const [events, overrides, timeZone] = await Promise.all([
    getAthleteCalendarEvents(clientId),
    getAthleteCalendarOverrides(clientId),
    getOperatingTimeZone(),
  ])

  return (
    <div className="space-y-3">
      {DEV_AUTH_BYPASS ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
          Demo calendar (dev bypass) — sample data shown; editing requires the live
          database.
        </p>
      ) : null}
      <AthleteCalendar clientId={clientId} events={events} overrides={overrides} timeZone={timeZone} />
    </div>
  )
}
