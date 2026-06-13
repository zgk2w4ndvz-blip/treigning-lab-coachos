// Realistic mock scheduled sessions for the current week and next few weeks.

import type { ScheduledSessionView } from "@/types/models"
import type { ScheduleSessionType, SessionModality, SessionStatus } from "@/types/database"

const ATHLETES: Record<string, { name: string; avatar: null }> = {
  "c-jordan": { name: "Jordan Vance", avatar: null },
  "c-maya":   { name: "Maya Okafor",  avatar: null },
  "c-devon":  { name: "Devon Reyes",  avatar: null },
  "c-priya":  { name: "Priya Nair",   avatar: null },
  "c-kai":    { name: "Kai Tanaka",   avatar: null },
  "c-cole":   { name: "Cole Whitaker",avatar: null },
  "c-marcus": { name: "Marcus Diaz",  avatar: null },
  "c-tyler":  { name: "Tyler Brooks", avatar: null },
  "c-sam":    { name: "Sam Nguyen",   avatar: null },
  "c-ethan":  { name: "Ethan Ross",   avatar: null },
}

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

interface Spec {
  id: string
  client: string | null
  title: string
  type: ScheduleSessionType
  dayOffset: number
  hour: number
  minute?: number
  duration: number
  modality: SessionModality | null
  location?: string
  notes?: string
  status?: SessionStatus
}

const SPECS: Spec[] = [
  // ── Today ──────────────────────────────────────────────────────────────────
  { id: "ss-01", client: "c-jordan", title: "Peak-week check-in", type: "check_in",        dayOffset: 0, hour: 8,  minute: 0,  duration: 20, modality: "phone" },
  { id: "ss-02", client: "c-maya",   title: "Nutrition consult",  type: "consultation",    dayOffset: 0, hour: 9,  minute: 30, duration: 45, modality: "virtual" },
  { id: "ss-03", client: "c-devon",  title: "Morning training",   type: "training",        dayOffset: 0, hour: 6,  minute: 0,  duration: 75, modality: "in_person", location: "Elite Performance Gym" },
  { id: "ss-04", client: "c-kai",    title: "Competition prep",   type: "competition_prep",dayOffset: 0, hour: 11, minute: 0,  duration: 60, modality: "virtual", notes: "Review fight-week cut protocol & fueling" },
  { id: "ss-05", client: "c-priya",  title: "Follow-up call",     type: "follow_up",       dayOffset: 0, hour: 14, minute: 0,  duration: 15, modality: "phone" },

  // ── Yesterday (completed) ──────────────────────────────────────────────────
  { id: "ss-y1", client: "c-cole",   title: "Weekly training",    type: "training",        dayOffset: -1, hour: 7,  duration: 90, modality: "in_person", location: "Elite Performance Gym", status: "completed" },
  { id: "ss-y2", client: "c-marcus", title: "Check-in",           type: "check_in",        dayOffset: -1, hour: 9,  duration: 15, modality: "phone",      status: "completed" },
  { id: "ss-y3", client: "c-sam",    title: "Recovery review",    type: "consultation",    dayOffset: -1, hour: 11, duration: 30, modality: "virtual",    status: "completed" },
  { id: "ss-y4", client: "c-tyler",  title: "Hydration debrief",  type: "follow_up",       dayOffset: -1, hour: 16, duration: 20, modality: "phone",      status: "no_show" },

  // ── Tomorrow ───────────────────────────────────────────────────────────────
  { id: "ss-06", client: "c-marcus", title: "Strength training",  type: "training",        dayOffset: 1, hour: 6,  minute: 30, duration: 90, modality: "in_person", location: "Elite Performance Gym" },
  { id: "ss-07", client: "c-ethan",  title: "Pre-competition strategy", type: "competition_prep", dayOffset: 1, hour: 10, duration: 60, modality: "virtual", notes: "Weigh-in plan + day-of nutrition" },
  { id: "ss-08", client: "c-tyler",  title: "Midweek check-in",  type: "check_in",        dayOffset: 1, hour: 13, duration: 20, modality: "phone" },
  { id: "ss-09", client: null, title: "Group programming review", type: "group_session", dayOffset: 1, hour: 15, minute: 30, duration: 45, modality: "virtual", notes: "Quarterly training block update for all wrestlers" },

  // ── Day +2 ─────────────────────────────────────────────────────────────────
  { id: "ss-10", client: "c-jordan", title: "Macro adjustment",   type: "consultation",    dayOffset: 2, hour: 8,  duration: 30, modality: "virtual" },
  { id: "ss-11", client: "c-maya",   title: "Conditioning session", type: "training",      dayOffset: 2, hour: 9,  duration: 75, modality: "in_person", location: "Elite Performance Gym" },
  { id: "ss-12", client: "c-priya",  title: "Supplement protocol", type: "consultation",  dayOffset: 2, hour: 14, duration: 30, modality: "virtual" },

  // ── Day +3 ─────────────────────────────────────────────────────────────────
  { id: "ss-13", client: "c-devon",  title: "Functional training", type: "training",       dayOffset: 3, hour: 7,  duration: 90, modality: "in_person", location: "Elite Performance Gym" },
  { id: "ss-14", client: "c-kai",    title: "Fight camp check-in",  type: "check_in",      dayOffset: 3, hour: 10, duration: 20, modality: "phone" },
  { id: "ss-15", client: "c-sam",    title: "Periodization consult", type: "consultation", dayOffset: 3, hour: 13, duration: 45, modality: "virtual", notes: "Transition from off-season to competition block" },

  // ── Day +4 ─────────────────────────────────────────────────────────────────
  { id: "ss-16", client: "c-cole",   title: "Lower body strength",  type: "training",      dayOffset: 4, hour: 6,  minute: 30, duration: 75, modality: "in_person", location: "Elite Performance Gym" },
  { id: "ss-17", client: "c-marcus", title: "Race-day prep",        type: "competition_prep", dayOffset: 4, hour: 9,  duration: 60, modality: "virtual" },
  { id: "ss-18", client: "c-tyler",  title: "End-of-week check-in", type: "check_in",      dayOffset: 4, hour: 12, duration: 15, modality: "phone" },
  { id: "ss-19", client: "c-ethan",  title: "Post-weigh-in debrief", type: "follow_up",    dayOffset: 4, hour: 14, minute: 30, duration: 30, modality: "phone" },

  // ── Next week ──────────────────────────────────────────────────────────────
  { id: "ss-20", client: "c-jordan", title: "Post-comp recovery plan", type: "consultation", dayOffset: 8, hour: 9,  duration: 45, modality: "virtual", notes: "Address post-competition recovery protocol" },
  { id: "ss-21", client: "c-maya",   title: "New training block",   type: "training",       dayOffset: 9, hour: 8,  duration: 90, modality: "in_person", location: "Elite Performance Gym" },
  { id: "ss-22", client: "c-devon",  title: "Nutrition reset",      type: "consultation",  dayOffset: 9, hour: 11, duration: 30, modality: "virtual" },
  { id: "ss-23", client: "c-priya",  title: "Monthly review",       type: "consultation",  dayOffset: 10, hour: 10, duration: 60, modality: "virtual", notes: "Full progress review + next 4-week block" },
  { id: "ss-24", client: "c-sam",    title: "Training session",     type: "training",       dayOffset: 11, hour: 7,  duration: 75, modality: "in_person", location: "Elite Performance Gym" },
  { id: "ss-25", client: "c-kai",    title: "Post-fight debrief",   type: "follow_up",     dayOffset: 12, hour: 14, duration: 45, modality: "virtual", notes: "Fight analysis + next camp planning" },

  // ── Cancelled example ──────────────────────────────────────────────────────
  { id: "ss-26", client: "c-ethan",  title: "Follow-up call",       type: "follow_up",     dayOffset: 2, hour: 16, duration: 15, modality: "phone", status: "cancelled" },
]

function makeView(s: Spec): ScheduledSessionView {
  const athlete = s.client ? ATHLETES[s.client] : null
  return {
    id: s.id,
    clientId: s.client ?? null,
    clientName: athlete?.name ?? null,
    avatarUrl: null,
    title: s.title,
    sessionType: s.type,
    scheduledAt: at(s.dayOffset, s.hour, s.minute ?? 0),
    durationMin: s.duration,
    location: s.location ?? null,
    modality: s.modality,
    notes: s.notes ?? null,
    status: s.status ?? "scheduled",
  }
}

export function mockScheduleSessions(): ScheduledSessionView[] {
  return SPECS.map(makeView).sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt)
  )
}

/** Generate schedule sessions for an imported (real) roster. */
export function generateImportedSchedule(
  clients: { id: string; first_name: string; last_name: string }[]
): ScheduledSessionView[] {
  const sessions: ScheduledSessionView[] = []

  const MODALITIES: SessionModality[] = ["in_person", "virtual", "phone"]

  clients.forEach((c, i) => {
    const name = `${c.first_name} ${c.last_name}`.trim()
    const dayBase = (i * 3) % 7

    // Two training sessions this week
    sessions.push({
      id: `imp-ss-tr1-${c.id}`,
      clientId: c.id,
      clientName: name,
      avatarUrl: null,
      title: `${c.first_name} — training`,
      sessionType: "training",
      scheduledAt: at(dayBase, 7),
      durationMin: 75,
      location: "Performance Facility",
      modality: "in_person",
      notes: null,
      status: "scheduled",
    })

    // Weekly check-in
    sessions.push({
      id: `imp-ss-ci-${c.id}`,
      clientId: c.id,
      clientName: name,
      avatarUrl: null,
      title: `${c.first_name} — weekly check-in`,
      sessionType: "check_in",
      scheduledAt: at((dayBase + 2) % 7, 8, 30),
      durationMin: 20,
      location: null,
      modality: MODALITIES[i % 3],
      notes: null,
      status: i % 5 === 0 ? "completed" : "scheduled",
    })
  })

  return sessions.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}
