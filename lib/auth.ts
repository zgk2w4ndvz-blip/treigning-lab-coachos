import "server-only"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  MOCK_ATHLETE_ID,
  mockClientProfile,
  mockProfile,
} from "@/lib/mock/athletes"
import type { Tables } from "@/types/database"

export type Profile = Tables<"profiles">

/** Current Clerk user id, or null if signed out. */
export async function getUserId(): Promise<string | null> {
  if (DEV_AUTH_BYPASS) return mockProfile.clerk_id
  const { userId } = await auth()
  return userId
}

/**
 * Load the Supabase profile row for the signed-in Clerk user.
 * Returns null if signed out or not yet synced.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  if (DEV_AUTH_BYPASS) return mockProfile

  const { userId } = await auth()
  if (!userId) return null

  // Admin (service-role) is appropriate here — this is profile *sync* for the
  // caller's OWN row, keyed by the Clerk-verified userId. It must work even
  // before the Clerk↔Supabase RLS provider is wired (resolving identity is what
  // RLS itself depends on), and it never reads or writes another user's data.
  // All other clients-table access goes through createServerSupabase()/RLS.
  const supabase = createAdminSupabase()

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_id", userId)
    .maybeSingle()
  if (existing) return existing

  // First sign-in without a configured webhook: create the coach profile on
  // demand. Upsert keeps this race-safe against the webhook / concurrent loads.
  const { data: created, error } = await supabase
    .from("profiles")
    .upsert({ clerk_id: userId, role: "coach" }, { onConflict: "clerk_id" })
    .select("*")
    .single()
  if (error) {
    console.error("getCurrentProfile: profile sync failed —", error.message)
    return null
  }
  return created
}

/** Require any authenticated, synced profile. Redirects otherwise. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/sign-in")
  return profile
}

/** Require a coach (or admin) profile. */
export async function requireCoach(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== "coach" && profile.role !== "admin") {
    redirect("/today")
  }
  return profile
}

/** Require a client profile. */
export async function requireClient(): Promise<Profile> {
  // In bypass the stand-in profile is a coach; serve the athlete portal as the
  // demo client instead of redirecting away from it.
  if (DEV_AUTH_BYPASS) return mockClientProfile
  const profile = await requireProfile()
  if (profile.role !== "client") {
    redirect("/dashboard")
  }
  return profile
}

/**
 * Resolve the `clients` row id for the signed-in athlete (the row whose
 * `profile_id` links to their profile). Bypass returns the demo athlete.
 */
export async function getCurrentAthleteClientId(): Promise<string | null> {
  if (DEV_AUTH_BYPASS) return MOCK_ATHLETE_ID

  const profile = await getCurrentProfile()
  if (!profile) return null

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle()

  return data?.id ?? null
}
