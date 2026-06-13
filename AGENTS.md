# Treigning Lab CoachOS — agent notes

- **Next.js 15** (App Router), pinned. Standard Next 15 conventions apply.
- **shadcn/ui** uses the **Radix** variant: components import from the unified
  `radix-ui` package (e.g. `import { Slot } from "radix-ui"`, `Slot.Root`).
- **Clerk v7**: `<SignedIn>/<SignedOut>` are not exported. Gate on the server
  via `getCurrentProfile()` / `requireCoach()` / `requireClient()` in `lib/auth.ts`.
- **Supabase** is reached only through `lib/supabase/{server,client,admin}.ts`.
  Never use the admin (service-role) client in user-facing code paths.
- Every new table needs an RLS policy in `supabase/migrations/`.
- Verify with: `npx tsc --noEmit && npx eslint . && npm run build`.
