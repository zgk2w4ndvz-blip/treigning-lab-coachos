import { z } from "zod"

import type { StoredSettings } from "@/lib/dev-settings-store"

/** Scalar fields of the Settings form (numbers coerced from FormData strings). */
export const settingsSchema = z.object({
  coach_name: z.string().trim().min(1, "Name is required"),
  coach_email: z.string().trim().email("Enter a valid email"),
  coach_phone: z.string().trim().default(""),
  coach_tz: z.string().trim().min(1, "Timezone is required"),
  biz_name: z.string().trim().default(""),
  biz_location: z.string().trim().default(""),
  biz_website: z.string().trim().default(""),
  nut_cal: z.coerce.number().int("Whole number").min(0).max(15000),
  nut_pro: z.coerce.number().int("Whole number").min(0).max(2000),
  nut_carb: z.coerce.number().int("Whole number").min(0).max(2000),
  nut_fat: z.coerce.number().int("Whole number").min(0).max(1000),
  hyd_oz: z.coerce.number().int("Whole number").min(0).max(500),
  al_weighin: z.coerce.number().int("Whole number").min(1).max(60),
  al_hyd: z.coerce.number().int("Whole number").min(0).max(100),
  al_sleep: z.coerce.number().min(0).max(14),
  al_sore: z.coerce.number().int("Whole number").min(0).max(10),
  al_protein: z.coerce.number().int("Whole number").min(0).max(100),
  cut_pct: z.coerce.number().min(0).max(10),
  cut_window: z.coerce.number().int("Whole number").min(0).max(96),
  cut_load: z.coerce.number().int("Whole number").min(0).max(21),
})

export type SettingsInput = z.infer<typeof settingsSchema>

/** Collect the dynamic `sup_{name,dose,time}_{i}` triples into a clean list. */
function collectSupplements(formData: FormData): StoredSettings["supplementDefaults"] {
  const out: StoredSettings["supplementDefaults"] = []
  for (let i = 0; formData.has(`sup_name_${i}`); i++) {
    const name = String(formData.get(`sup_name_${i}`) ?? "").trim()
    if (!name) continue
    out.push({
      name,
      dosage: String(formData.get(`sup_dose_${i}`) ?? "").trim(),
      timing: String(formData.get(`sup_time_${i}`) ?? "").trim(),
    })
  }
  return out
}

/**
 * Build the structured StoredSettings payload from validated scalars plus the
 * raw FormData (needed for checkbox presence and the dynamic supplement rows).
 */
export function buildStoredSettings(
  v: SettingsInput,
  formData: FormData
): StoredSettings {
  return {
    coach: {
      fullName: v.coach_name,
      email: v.coach_email,
      phone: v.coach_phone,
      timezone: v.coach_tz,
    },
    business: {
      name: v.biz_name,
      location: v.biz_location,
      website: v.biz_website,
    },
    notifications: {
      emailAlerts: formData.has("notif_email"),
      smsAlerts: formData.has("notif_sms"),
      weeklyDigest: formData.has("notif_digest"),
      dailyAgenda: formData.has("notif_agenda"),
    },
    nutritionDefaults: {
      calories: v.nut_cal,
      protein: v.nut_pro,
      carbs: v.nut_carb,
      fat: v.nut_fat,
    },
    hydrationDefaults: { ozTarget: v.hyd_oz },
    supplementDefaults: collectSupplements(formData),
    alertThresholds: {
      missedWeighInDays: v.al_weighin,
      lowHydrationPct: v.al_hyd,
      poorSleepHours: v.al_sleep,
      highSoreness: v.al_sore,
      lowProteinPct: v.al_protein,
    },
    weightCutDefaults: {
      maxPctPerDay: v.cut_pct,
      rehydrationWindowHours: v.cut_window,
      waterLoadDays: v.cut_load,
    },
  }
}
