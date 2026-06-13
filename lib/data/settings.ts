import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getCurrentProfile } from "@/lib/auth"
import { getMockSettings } from "@/lib/mock/settings"
import { readStoredSettings, type StoredSettings } from "@/lib/dev-settings-store"
import type { CoachSettingsData } from "@/types/models"

/** Re-attach the env-driven devMode flag onto a stored/default payload. */
function withDevMode(s: StoredSettings): CoachSettingsData {
  return { ...s, devMode: { authBypass: DEV_AUTH_BYPASS } }
}

/**
 * Coach settings for the Settings page. Bypass: local store (falling back to
 * mock defaults). Real: the `coach_settings` row, with the rich structure we
 * can't express as columns rehydrated from the `alert_prefs` JSON blob.
 */
export async function getCoachSettings(): Promise<CoachSettingsData> {
  const defaults = getMockSettings()

  if (DEV_AUTH_BYPASS) {
    const stored = readStoredSettings()
    return withDevMode(stored ?? defaults)
  }

  const profile = await getCurrentProfile()
  if (!profile) return defaults

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("coach_settings")
    .select("business_name, timezone, notification_prefs, alert_prefs")
    .eq("coach_id", profile.id)
    .maybeSingle()

  if (!data) return defaults

  // alert_prefs packs everything that has no dedicated column.
  const prefs = (data.alert_prefs ?? {}) as Partial<StoredSettings>
  const notif = (data.notification_prefs ??
    defaults.notifications) as CoachSettingsData["notifications"]

  return withDevMode({
    coach: {
      ...defaults.coach,
      ...prefs.coach,
      timezone: data.timezone ?? defaults.coach.timezone,
    },
    business: {
      ...defaults.business,
      ...prefs.business,
      name: data.business_name ?? prefs.business?.name ?? defaults.business.name,
    },
    notifications: notif,
    nutritionDefaults: prefs.nutritionDefaults ?? defaults.nutritionDefaults,
    hydrationDefaults: prefs.hydrationDefaults ?? defaults.hydrationDefaults,
    supplementDefaults: prefs.supplementDefaults ?? defaults.supplementDefaults,
    alertThresholds: prefs.alertThresholds ?? defaults.alertThresholds,
    weightCutDefaults: prefs.weightCutDefaults ?? defaults.weightCutDefaults,
  })
}
