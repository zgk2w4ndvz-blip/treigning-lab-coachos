/**
 * DEV-ONLY auth/data bypass.
 *
 * When `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` AND we are not in a production build,
 * the auth guards return a stand-in coach and the data layer serves in-memory
 * mock fixtures instead of querying Clerk / Supabase. This lets you click
 * through the app with no real credentials.
 *
 * Hard-gated on NODE_ENV so it can NEVER activate in `next build` / production.
 */
export const DEV_AUTH_BYPASS =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true" &&
  process.env.NODE_ENV !== "production"
