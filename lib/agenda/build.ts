// ============================================================================
// Pure agenda mappers + bucketing. No I/O — unit-tested directly. Converts the
// various existing CoachOS rows into the normalized AgendaItem shape and decides
// whether a day falls in "today" / "upcoming" / "other". Recurrence expansion is
// NOT duplicated here — calendar occurrences come pre-expanded from
// lib/calendar/recurrence (timezone-safe, PR #4).
// ============================================================================

import type {
  AgendaItem,
  AgendaItemPriority,
  CalendarOccurrence,
  Competition,
  RecoveryLog,
  Task,
} from "@/types/models"

/** Calendar categories that warrant high priority on the agenda. */
const HIGH_CATEGORIES = new Set<string>(["competition", "weigh_in"])

export function calendarPriority(category: string): AgendaItemPriority {
  return HIGH_CATEGORIES.has(category) ? "high" : "medium"
}

export function occurrenceToItem(
  occ: CalendarOccurrence,
  athleteName: string | null
): AgendaItem {
  const ev = occ.event
  return {
    id: `cal-${occ.key}`,
    type: "calendar",
    title: ev.title,
    athleteId: ev.client_id,
    athleteName: athleteName ?? undefined,
    startsAt: occ.start,
    detail: ev.category,
    href: `/clients/${ev.client_id}/calendar`,
    priority: calendarPriority(ev.category),
  }
}

export function competitionToItem(c: Competition, athleteName: string | null): AgendaItem {
  return {
    id: `comp-${c.id}`,
    type: "competition",
    title: c.name,
    athleteId: c.client_id,
    athleteName: athleteName ?? undefined,
    startsAt: c.competition_date ? `${c.competition_date}T00:00:00` : undefined,
    detail: c.weight_class ?? undefined,
    href: `/clients/${c.client_id}/competitions`,
    priority: "high",
  }
}

export function overdueTaskToItem(t: Task, athleteName: string | null): AgendaItem {
  return {
    id: `task-${t.id}`,
    type: "task",
    title: t.title,
    athleteId: t.client_id ?? undefined,
    athleteName: athleteName ?? undefined,
    startsAt: t.due_date ? `${t.due_date}T00:00:00` : undefined,
    detail: "Overdue",
    href: "/tasks",
    priority: "high",
  }
}

export function recoveryToItem(log: RecoveryLog, athleteName: string | null): AgendaItem {
  return {
    id: `rec-${log.id}`,
    type: "recovery",
    title: "Recovery logged",
    athleteId: log.client_id,
    athleteName: athleteName ?? undefined,
    startsAt: `${log.logged_date}T00:00:00`,
    detail: log.modalities?.length ? log.modalities.join(", ") : undefined,
    href: `/clients/${log.client_id}/recovery`,
    priority: "low",
  }
}

export function behindPlanToItem(
  clientId: string,
  athleteName: string | null,
  detail: string
): AgendaItem {
  return {
    id: `wp-${clientId}`,
    type: "weight-plan",
    title: "Behind weight target",
    athleteId: clientId,
    athleteName: athleteName ?? undefined,
    detail,
    href: `/clients/${clientId}/weight-plan`,
    priority: "high",
  }
}

/**
 * Is the latest weigh-in behind the current week's target by more than the
 * threshold? Direction-aware (a cut is "behind" when still too heavy).
 */
export function weightPlanBehind(opts: {
  latest: number | null
  target: number | null
  direction: "cut" | "gain" | "maintain"
  thresholdLb?: number
}): boolean {
  const { latest, target, direction, thresholdLb = 1 } = opts
  if (latest == null || target == null) return false
  if (direction === "cut") return latest - target > thresholdLb
  if (direction === "gain") return target - latest > thresholdLb
  return Math.abs(latest - target) > thresholdLb
}

/** Classify a yyyy-MM-dd day relative to today and the 7-day horizon. */
export function bucketDay(
  dayKey: string,
  todayKey: string,
  horizonKey: string
): "today" | "upcoming" | "other" {
  if (dayKey === todayKey) return "today"
  if (dayKey > todayKey && dayKey <= horizonKey) return "upcoming"
  return "other"
}

/** Stable sort by startsAt (items without a time sort last). */
export function byStartsAt(a: AgendaItem, b: AgendaItem): number {
  if (!a.startsAt) return 1
  if (!b.startsAt) return -1
  return a.startsAt.localeCompare(b.startsAt)
}
