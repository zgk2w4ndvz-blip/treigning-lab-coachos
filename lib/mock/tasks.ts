// Realistic mock coach tasks spanning every task type + due-date bucket.

import type {
  CoachTaskView,
  ImportedAthlete,
  Priority,
  TaskStatus,
  TaskType,
} from "@/types/models"

const NAMES: Record<string, string> = {
  "c-jordan": "Jordan Vance",
  "c-maya": "Maya Okafor",
  "c-devon": "Devon Reyes",
  "c-priya": "Priya Nair",
  "c-kai": "Kai Tanaka",
  "c-cole": "Cole Whitaker",
  "c-marcus": "Marcus Diaz",
  "c-tyler": "Tyler Brooks",
  "c-sam": "Sam Nguyen",
  "c-ethan": "Ethan Ross",
}

function dateFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

interface Spec {
  id: string
  client: string | null
  title: string
  type: TaskType
  priority: Priority
  due: number | null // days from now
  status?: TaskStatus
  completed?: number // days from now (negative)
}

const SPECS: Spec[] = [
  // overdue
  { id: "t1", client: "c-cole", title: "Review Cole's sleep dip", type: "recovery", priority: "high", due: -1 },
  { id: "t2", client: "c-ethan", title: "Confirm Ethan's weigh-in time", type: "competition", priority: "urgent", due: -1 },
  { id: "t3", client: "c-priya", title: "Reply to Priya's check-in message", type: "communication", priority: "low", due: -2, status: "in_progress" },
  // due today
  { id: "t4", client: "c-devon", title: "Call Devon re: hydration", type: "hydration", priority: "urgent", due: 0 },
  { id: "t5", client: "c-marcus", title: "Send Marcus his water-cut protocol", type: "weight_cut", priority: "urgent", due: 0 },
  { id: "t6", client: "c-jordan", title: "Review Jordan's peak-week macros", type: "nutrition", priority: "high", due: 0, status: "in_progress" },
  // this week
  { id: "t7", client: "c-maya", title: "Follow up with Maya (no reply 3d)", type: "communication", priority: "medium", due: 1 },
  { id: "t8", client: "c-kai", title: "Adjust Kai's supplement timing", type: "supplements", priority: "medium", due: 2 },
  { id: "t9", client: "c-kai", title: "Check Kai's HRV trend", type: "recovery", priority: "low", due: 3 },
  { id: "t10", client: "c-cole", title: "Confirm Cole's sauna schedule", type: "weight_cut", priority: "high", due: 3 },
  { id: "t11", client: "c-sam", title: "Program Sam's hypertrophy week 3", type: "training", priority: "medium", due: 4 },
  { id: "t12", client: "c-jordan", title: "Finalize Jordan's attempt selections", type: "competition", priority: "medium", due: 5 },
  // later
  { id: "t13", client: null, title: "Draft monthly newsletter", type: "general", priority: "low", due: 9 },
  { id: "t14", client: null, title: "Order gym recovery supplies", type: "general", priority: "low", due: 12 },
  { id: "t15", client: "c-tyler", title: "Build Tyler's off-season nutrition plan", type: "nutrition", priority: "low", due: 14 },
  // completed
  { id: "t16", client: "c-kai", title: "Book Kai's travel + hotel", type: "competition", priority: "medium", due: -3, status: "done", completed: -2 },
  { id: "t17", client: "c-jordan", title: "Set Jordan's hydration target", type: "hydration", priority: "low", due: -4, status: "done", completed: -4 },
  { id: "t18", client: "c-devon", title: "Log initial consult notes", type: "communication", priority: "medium", due: -5, status: "done", completed: -5 },
]

export function mockCoachTasks(): CoachTaskView[] {
  return SPECS.map((s) => ({
    id: s.id,
    clientId: s.client,
    clientName: s.client ? NAMES[s.client] ?? null : null,
    title: s.title,
    description: null,
    type: s.type,
    status: s.status ?? "open",
    priority: s.priority,
    dueDate: s.due != null ? dateFromNow(s.due) : null,
    completedAt: s.completed != null ? dateFromNow(s.completed) : null,
  }))
}

/** Generate sensible coach tasks for an imported (real) roster. */
export function generateImportedTasks(athletes: ImportedAthlete[]): CoachTaskView[] {
  const out: CoachTaskView[] = []
  const today = dateFromNow(0)

  athletes.forEach((a, i) => {
    const name = `${a.firstName} ${a.lastName}`
    const mk = (
      suffix: string,
      title: string,
      type: TaskType,
      priority: Priority,
      due: string | null
    ): CoachTaskView => ({
      id: `imp-task-${a.id}-${suffix}`,
      clientId: a.id,
      clientName: name,
      title,
      description: null,
      type,
      status: "open",
      priority,
      dueDate: due,
      completedAt: null,
    })

    out.push(
      mk(
        "checkin",
        `Check in with ${a.firstName}`,
        "communication",
        i % 3 === 0 ? "high" : "medium",
        dateFromNow(i % 5)
      )
    )

    if (a.coachNotes) {
      const note = a.coachNotes.length > 48 ? `${a.coachNotes.slice(0, 48)}…` : a.coachNotes
      out.push(
        mk("note", `Review note — ${a.firstName}: "${note}"`, "general", "low", dateFromNow((i % 3) + 1))
      )
    }

    if (a.competitionDate) {
      const daysOut = Math.ceil(
        (new Date(a.competitionDate).getTime() - Date.now()) / 86_400_000
      )
      const due =
        daysOut > 7
          ? new Date(new Date(a.competitionDate).getTime() - 7 * 86_400_000)
              .toISOString()
              .slice(0, 10)
          : today
      out.push(
        mk(
          "comp",
          `Confirm logistics — ${a.nextCompetition ?? "competition"} (${name})`,
          "competition",
          daysOut <= 14 ? "urgent" : "high",
          due
        )
      )
    }

    if (
      a.goalWeight != null &&
      a.currentWeight != null &&
      a.goalWeight < a.currentWeight - 1
    ) {
      out.push(
        mk(
          "cut",
          `Review ${a.firstName}'s weight plan (${a.currentWeight} → ${a.goalWeight} lb)`,
          "weight_cut",
          "medium",
          dateFromNow(2)
        )
      )
    }
  })

  return out
}
