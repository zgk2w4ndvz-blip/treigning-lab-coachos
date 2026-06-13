import { DEFAULT_RULES } from "@/lib/alerts/rules-config"
import type { CoachSettingsData } from "@/types/models"

/** Mock coach settings (defaults seeded from the live alert rules). */
export function getMockSettings(): CoachSettingsData {
  return {
    coach: {
      fullName: "Dev Coach",
      email: "dev@coachos.local",
      phone: "(555) 010-2233",
      timezone: "America/New_York",
    },
    business: {
      name: "Treigning Lab",
      location: "Austin, TX",
      website: "treigninglab.com",
    },
    notifications: {
      emailAlerts: true,
      smsAlerts: false,
      weeklyDigest: true,
      dailyAgenda: true,
    },
    nutritionDefaults: { calories: 2600, protein: 190, carbs: 280, fat: 70 },
    hydrationDefaults: { ozTarget: 110 },
    supplementDefaults: [
      { name: "Creatine Monohydrate", dosage: "5 g", timing: "Morning" },
      { name: "Whey Isolate", dosage: "30 g", timing: "Post-workout" },
      { name: "Vitamin D3", dosage: "2000 IU", timing: "Morning" },
    ],
    alertThresholds: {
      missedWeighInDays: DEFAULT_RULES.missed_weigh_in.days,
      lowHydrationPct: DEFAULT_RULES.low_hydration.pct,
      poorSleepHours: DEFAULT_RULES.poor_sleep.hours,
      highSoreness: DEFAULT_RULES.high_soreness.level,
      lowProteinPct: DEFAULT_RULES.low_protein.pct,
    },
    weightCutDefaults: {
      maxPctPerDay: DEFAULT_RULES.aggressive_weight_cut.max_pct_per_day,
      rehydrationWindowHours: 24,
      waterLoadDays: 5,
    },
    devMode: { authBypass: false },
  }
}
