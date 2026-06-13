import Link from "next/link"
import { Pencil, MessageSquare } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ClientStatusBadge } from "@/components/shared/badges"
import { DeleteClientButton } from "@/components/coach/delete-client-button"
import { fullName, initials } from "@/lib/utils/format"
import type { Client } from "@/types/models"

export function ClientHeader({ client }: { client: Client }) {
  const name = fullName(client.first_name, client.last_name)
  const meta = [client.sport, client.discipline, client.current_weight_class]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={client.avatar_url ?? undefined} />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{name}</h1>
            <ClientStatusBadge status={client.status} />
          </div>
          {meta ? (
            <p className="text-muted-foreground text-sm">{meta}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${client.id}/messages`}>
            <MessageSquare className="size-4" />
            Message
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${client.id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
        <DeleteClientButton clientId={client.id} name={name} variant="full" />
      </div>
    </div>
  )
}
