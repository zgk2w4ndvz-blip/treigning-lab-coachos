import "server-only"

import { listActiveCutsForBoard, getClientWeightSeries } from "@/lib/data/combat"
import {
  cutRisk,
  daysUntil,
  measuredDailyLossRate,
  projectCut,
} from "@/lib/wrestling/projection"
import { fullName } from "@/lib/utils/format"
import type {
  CombatCutListItem,
  WrestlingCommandCenter,
  WrestlingCutRow,
} from "@/types/models"

function buildRow(item: CombatCutListItem, series: { date: string; weight: number }[]): WrestlingCutRow {
  const lossRate = measuredDailyLossRate(series)
  const proj = projectCut({
    currentLbs: item.latestWeightLbs,
    targetLbs: item.cut.target_weigh_in_lbs,
    weighInAt: item.cut.weigh_in_at,
    dailyLossRateLbs: lossRate,
  })
  const risk = cutRisk(proj.pctBodyweightPerDay, item.readiness.overall)

  return {
    cutId: item.cut.id,
    clientId: item.client.id,
    name: fullName(item.client.first_name, item.client.last_name),
    avatarUrl: item.client.avatar_url,
    className: item.cut.class_name,
    classLimitLbs: item.cut.class_limit_lbs,
    competitionAt: item.cut.competition_at,
    weighInAt: item.cut.weigh_in_at,
    currentLbs: proj.currentLbs,
    targetLbs: item.cut.target_weigh_in_lbs,
    projectedLbs: proj.projectedLbs,
    toGoLbs: proj.toGoLbs,
    daysToWeighIn: proj.daysToWeighIn,
    weeklyLossTargetLbs: proj.weeklyLossTargetLbs,
    dailyLossTargetLbs: proj.dailyLossTargetLbs,
    dailyLossRateLbs: proj.dailyLossRateLbs,
    pctBodyweightPerDay: proj.pctBodyweightPerDay,
    pace: proj.pace,
    paceDeltaLbs: proj.paceDeltaLbs,
    risk,
    readiness: item.readiness.overall,
    hydrationPlan: item.cut.hydration_restoration,
  }
}

/** Wrestling Command Center: every active wrestling cut, projected + bucketed. */
export async function getWrestlingCommandCenter(): Promise<WrestlingCommandCenter> {
  const board = (await listActiveCutsForBoard()).filter(
    (i) => i.cut.discipline === "wrestling"
  )

  const rows = await Promise.all(
    board.map(async (item) => {
      const series = await getClientWeightSeries(item.client.id, 14)
      return buildRow(item, series)
    })
  )

  rows.sort((a, b) => (a.daysToWeighIn ?? 1e9) - (b.daysToWeighIn ?? 1e9))

  return {
    rows,
    onPace: rows.filter((r) => r.pace === "on"),
    offPace: rows.filter((r) => r.pace === "off"),
    highRisk: rows.filter((r) => r.risk === "high"),
    weighInsWithin14: rows.filter(
      (r) => r.daysToWeighIn != null && r.daysToWeighIn <= 14
    ),
    competitionsWithin30: rows.filter((r) => {
      const d = daysUntil(r.competitionAt)
      return d != null && d <= 30
    }),
  }
}
