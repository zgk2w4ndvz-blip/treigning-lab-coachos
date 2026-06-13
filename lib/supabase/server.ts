import "server-only"

import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

/**
 * Server-side Supabase client scoped to the current Clerk user.
 * The Clerk session token is forwarded to Supabase so RLS policies can
 * resolve the caller via `auth.jwt() ->> 'sub'`. Requires Clerk to be
 * configured as a Supabase third-party auth provider.
 */
export async function createServerSupabase() {
  const { getToken } = await auth()

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await getToken()) ?? null
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
