"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteClientAction } from "@/lib/actions/clients"
import { Button } from "@/components/ui/button"

export function DeleteClientButton({
  clientId,
  name,
  variant = "icon",
}: {
  clientId: string
  name: string
  variant?: "icon" | "full"
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function remove() {
    if (!confirm(`Delete ${name}? This permanently removes the client.`)) return
    start(async () => {
      const res = await deleteClientAction(clientId)
      if (res.ok) {
        toast.success(`Deleted ${name}`)
        // From the detail page the record is gone, so navigate away.
        if (variant === "full") router.push("/clients/manage")
        else router.refresh()
      } else {
        toast.error(res.error ?? "Delete failed")
      }
    })
  }

  if (variant === "full") {
    return (
      <Button variant="outline" size="sm" onClick={remove} disabled={pending} className="text-destructive">
        <Trash2 className="size-4" />
        Delete client
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={remove}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive size-8"
      aria-label={`Delete ${name}`}
    >
      <Trash2 className="size-4" />
    </Button>
  )
}
