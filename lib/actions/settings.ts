"use server"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { writeStoredSettings } from "@/lib/dev-settings-store"
import { buildStoredSettings, settingsSchema } from "@/lib/validations/settings"
import type { ActionState } from "@/lib/actions/types"
import type { Json } from "@/types/database"

const asJson = <T>(v: T): Json => v as unknown as Json

/**
 * Persist coach settings. Bypass writes the full payload to the local settings
 * store; real mode upserts the `coach_settings` row (rich fields packed into the
 * `alert_prefs` / `notification_prefs` JSON columns).
 */
export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = settingsSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const settings = buildStoredSettings(parsed.data, formData)

  try {
    if (DEV_AUTH_BYPASS) {
      writeStoredSettings(settings)
    } else {
      const profile = await requireCoach()
      const supabase = await createServerSupabase()
      const { coach, business, notifications, ...rest } = settings
      const { error } = await supabase.from("coach_settings").upsert(
        {
          coach_id: profile.id,
          business_name: business.name || null,
          timezone: coach.timezone,
          notification_prefs: asJson(notifications),
          // Pack everything without a dedicated column into alert_prefs.
          alert_prefs: asJson({ coach, business, ...rest }),
        },
        { onConflict: "coach_id" }
      )
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidatePath("/settings")
  return { ok: true }
}
