// Realistic mock calendar events spanning the current month window.

import { WRESTLERS, mockTrainingSessions } from "@/lib/mock/series"
import { fullName } from "@/lib/utils/format"
import type {
  CalendarEvent,
  CalendarEventType,
  Client,
  Competition,
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

function at(offsetDays: number, hour: number, min = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

function ev(
  id: string,
  type: CalendarEventType,
  title: string,
  date: string,
  client: string | null,
  detail: string | null,
  durationMin: number | null
): CalendarEvent {
  return {
    id,
    type,
    title,
    date,
    clientId: client,
    clientName: client ? NAMES[client] ?? null : null,
    detail,
    durationMin,
  }
}

const TRAINING: [string, number, number][] = [
  ["c-jordan", 0, 16], ["c-jordan", 2, 16], ["c-jordan", 4, 16],
  ["c-maya", 0, 9], ["c-maya", 1, 9], ["c-maya", 3, 9],
  ["c-devon", 1, 6], ["c-devon", 3, 6], ["c-devon", 5, 6],
  ["c-kai", 0, 11], ["c-kai", 2, 11], ["c-kai", 4, 11],
  ["c-cole", 1, 15], ["c-cole", 3, 15],
  ["c-marcus", 0, 7], ["c-marcus", 2, 7],
  ["c-sam", 1, 17], ["c-sam", 4, 17],
  ["c-priya", 2, 18], ["c-tyler", 3, 12],
]

const CHECK_INS: [string, number][] = [
  ["c-devon", 1], ["c-jordan", 2], ["c-maya", 4], ["c-priya", 6],
  ["c-tyler", 5], ["c-sam", 8], ["c-kai", 7],
]

const CONSULTS: [string, number, number][] = [
  ["c-marcus", 1, 11], ["c-kai", 3, 14], ["c-jordan", 7, 15], ["c-sam", 9, 13],
]

const FOLLOW_UPS: [string, number][] = [
  ["c-devon", 0], ["c-maya", 2], ["c-priya", 5], ["c-tyler", 6], ["c-ethan", 1],
]

export function mockCalendarEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // weigh-ins + competitions from active cuts
  for (const w of WRESTLERS) {
    const name = NAMES[w.id]
    events.push(
      ev(`wi-${w.id}`, "weigh_in", `${name} weigh-in (${w.className})`, at(w.weighInDays, 8), w.id, `Official weigh-in — target ${w.classLimit} lb`, 30)
    )
    events.push(
      ev(`comp-${w.id}`, "competition", `${name} — dual meet`, at(w.compDays, 17), w.id, `Wrestling ${w.className}`, 240)
    )
  }
  events.push(ev("wi-kai", "weigh_in", "Kai Tanaka weigh-in (Welterweight)", at(10, 9), "c-kai", "Official weigh-in — target 170 lb", 30))
  events.push(ev("comp-kai", "competition", "Apex FC 42 — Kai Tanaka", at(11, 17), "c-kai", "MMA title fight", 300))
  events.push(ev("comp-jordan", "competition", "USAPL Raw Nationals — Jordan", at(25, 9), "c-jordan", "Powerlifting -83kg", 480))

  let i = 0
  for (const [c, off, hr] of TRAINING) {
    events.push(ev(`tr-${i++}`, "training", `${NAMES[c]} — training`, at(off, hr), c, "Programmed session", 75))
  }
  i = 0
  for (const [c, off] of CHECK_INS) {
    events.push(ev(`ci-${i++}`, "check_in", `${NAMES[c]} — weight check-in`, at(off, 7, 30), c, "Daily weigh-in + photos", 15))
  }
  i = 0
  for (const [c, off, hr] of CONSULTS) {
    events.push(ev(`co-${i++}`, "consultation", `Consultation — ${NAMES[c]}`, at(off, hr), c, "Video consult", 45))
  }
  i = 0
  for (const [c, off] of FOLLOW_UPS) {
    events.push(ev(`fu-${i++}`, "follow_up", `Follow up — ${NAMES[c]}`, at(off, 12), c, "Check message / adherence", 15))
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

/** Generate calendar events for an imported (real) roster. */
export function generateImportedCalendar(
  clients: Client[],
  competitions: Competition[]
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const nameById = new Map(
    clients.map((c) => [c.id, fullName(c.first_name, c.last_name)])
  )

  // competitions + estimated weigh-ins (day before, 8:00)
  for (const comp of competitions) {
    const name = nameById.get(comp.client_id) ?? "Athlete"
    events.push({
      id: `cal-comp-${comp.id}`,
      type: "competition",
      title: `${comp.name} — ${name}`,
      date: `${comp.competition_date}T09:00:00`,
      clientId: comp.client_id,
      clientName: name,
      detail: comp.weight_class,
      durationMin: 240,
    })
    const weighIn = new Date(`${comp.competition_date}T08:00:00`)
    weighIn.setDate(weighIn.getDate() - 1)
    if (weighIn.getTime() > Date.now() - 86_400_000) {
      events.push({
        id: `cal-wi-${comp.id}`,
        type: "weigh_in",
        title: `${name} weigh-in (est.)`,
        date: weighIn.toISOString(),
        clientId: comp.client_id,
        clientName: name,
        detail: `Day before ${comp.name}`,
        durationMin: 30,
      })
    }
  }

  // training (from the deterministic session generator), check-ins, follow-ups
  clients.forEach((c, i) => {
    const name = nameById.get(c.id) ?? "Athlete"
    for (const s of mockTrainingSessions(c.id)) {
      if (!s.scheduled_at) continue
      events.push({
        id: `cal-tr-${s.id}`,
        type: "training",
        title: `${name} — training`,
        date: s.scheduled_at,
        clientId: c.id,
        clientName: name,
        detail: s.session_type ?? "Programmed session",
        durationMin: s.duration_min,
      })
    }
    events.push({
      id: `cal-ci-${c.id}`,
      type: "check_in",
      title: `${name} — weight check-in`,
      date: at(i % 7, 7, 30),
      clientId: c.id,
      clientName: name,
      detail: "Weekly weigh-in + review",
      durationMin: 15,
    })
    events.push({
      id: `cal-fu-${c.id}`,
      type: "follow_up",
      title: `Follow up — ${name}`,
      date: at(i % 5, 12),
      clientId: c.id,
      clientName: name,
      detail: "Check message / adherence",
      durationMin: 15,
    })
  })

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
