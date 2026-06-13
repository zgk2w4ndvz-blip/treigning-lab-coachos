import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

import { DEV_AUTH_BYPASS } from "@/lib/dev"

// Everything except these is protected.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
])

// In dev bypass mode, skip Clerk entirely — every route is open.
export default DEV_AUTH_BYPASS
  ? function middleware() {}
  : clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect()
      }
    })

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
}
