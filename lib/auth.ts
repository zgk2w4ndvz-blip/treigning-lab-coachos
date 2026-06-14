import "server-only"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { createServerSupabase } from "@/lib/supabase/server"
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

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_id", userId)
    .maybeSingle()

  if (data) return data

  const { data: created } = await supabase
    .from("profiles")
    .insert({
      clerk_id: userId,
      role: "coach",
    })
    .select("*")
    .single()

  return created ?? null
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
