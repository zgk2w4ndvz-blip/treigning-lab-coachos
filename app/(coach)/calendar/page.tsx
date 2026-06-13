import { requireCoach } from "@/lib/auth"
import { getCalendarEvents } from "@/lib/data/calendar"
import { PageHeader } from "@/components/shared/page-header"
import { CalendarView } from "@/components/calendar/calendar-view"

export default async function CalendarPage() {
  await requireCoach()
  const events = await getCalendarEvents()

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Calendar"
        description="Competitions, weigh-ins, check-ins, training, consultations, and follow-ups across your roster."
      />
      <CalendarView events={events} />
    </main>
  )
}
