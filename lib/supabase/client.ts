"use client"

import { useMemo } from "react"
import { useSession } from "@clerk/nextjs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

/**
 * Browser-side Supabase client bound to the active Clerk session.
 * Use inside client components / React Query fetchers.
 */
export function useSupabaseBrowser(): SupabaseClient<Database> {
  const { session } = useSession()

  return useMemo(() => {
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        async accessToken() {
          return (await session?.getToken()) ?? null
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
    // Recreate only when the session identity changes; getToken is read lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])
}
