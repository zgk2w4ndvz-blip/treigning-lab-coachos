import { Check, Circle, UserX } from "lucide-react"

import { getCurrentAthleteClientId } from "@/lib/auth"
import { getAthleteToday } from "@/lib/data/athlete"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { CompletionRing } from "@/components/athlete/completion-ring"
import { CoachNotesCard } from "@/components/athlete/coach-notes-card"
import {
  HydrationEntry,
  NutritionEntry,
  RecoveryEntry,
  SupplementChecklist,
  WeightEntry,
} from "@/components/athlete/today-entries"

export default async function TodayPage() {
  const clientId = await getCurrentAthleteClientId()
  const today = clientId ? await getAthleteToday(clientId) : null

  if (!today) {
    return (
      <EmptyState
        icon={UserX}
        title="No athlete profile linked"
        description="Your login isn't connected to an athlete record yet. Ask your coach to add you."
      />
    )
  }

  const loggedCount = today.domains.filter((d) => d.logged).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Today</h1>
        <p className="text-muted-foreground text-sm">{formatDate(today.date)}</p>
      </div>

      {/* Daily completion + checklist */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <CompletionRing
            score={today.completionScore}
            label={`${loggedCount}/${today.domains.length} logged`}
          />
          <ul className="flex-1 space-y-1.5">
            {today.domains.map((d) => (
              <li key={d.domain} className="flex items-center gap-2 text-sm">
                {d.logged ? (
                  <Check className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="text-muted-foreground/40 size-4 shrink-0" />
                )}
                <span
                  className={cn(
                    "flex-1",
                    d.logged ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {d.label}
                </span>
                {d.summary ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {d.summary}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {today.coachNotes ? <CoachNotesCard notes={today.coachNotes} /> : null}

      <h2 className="px-1 pt-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Log your day
      </h2>

      <WeightEntry data={today.weight} />
      <HydrationEntry data={today.hydration} />
      <NutritionEntry data={today.nutrition} />
      <SupplementChecklist supplements={today.supplements} />
      <RecoveryEntry data={today.recovery} />
    </div>
  )
}
