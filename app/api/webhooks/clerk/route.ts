import { headers } from "next/headers"
import { Webhook } from "svix"
import type { WebhookEvent } from "@clerk/nextjs/server"

import { createAdminSupabase } from "@/lib/supabase/admin"
import type { Role } from "@/types/database"

/**
 * Clerk webhook: keeps the `profiles` table in sync with Clerk users.
 * Configure the endpoint URL + signing secret in the Clerk dashboard.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
  if (!secret) {
    return new Response("Missing CLERK_WEBHOOK_SIGNING_SECRET", { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get("svix-id")
  const svixTimestamp = headerPayload.get("svix-timestamp")
  const svixSignature = headerPayload.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  const body = await req.text()

  let event: WebhookEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }

  const supabase = createAdminSupabase()

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const u = event.data
      const primaryEmail =
        u.email_addresses.find((e) => e.id === u.primary_email_address_id)
          ?.email_address ?? u.email_addresses[0]?.email_address ?? null
      const fullName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") || null
      const role = ((u.public_metadata?.role as Role) ?? "coach") as Role

      const { error } = await supabase.from("profiles").upsert(
        {
          clerk_id: u.id,
          email: primaryEmail,
          full_name: fullName,
          avatar_url: u.image_url ?? null,
          role,
        },
        { onConflict: "clerk_id" }
      )
      if (error) {
        return new Response(`Sync failed: ${error.message}`, { status: 500 })
      }
      break
    }

    case "user.deleted": {
      const id = event.data.id
      if (id) {
        await supabase.from("profiles").delete().eq("clerk_id", id)
      }
      break
    }
  }

  return new Response("ok", { status: 200 })
}
