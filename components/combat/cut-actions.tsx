"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RefreshCw, Pencil } from "lucide-react"
import { toast } from "sonner"

import {
  regenerateProtocolsAction,
  deleteWeightCutAction,
} from "@/lib/actions/combat"
import { Button } from "@/components/ui/button"

export function CutActions({
  cutId,
  clientId,
}: {
  cutId: string
  clientId: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function regenerate() {
    start(async () => {
      const res = await regenerateProtocolsAction(cutId, clientId)
      if (res.ok) {
        toast.success("Protocols regenerated")
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to regenerate")
      }
    })
  }

  function remove() {
    if (!confirm("Delete this weight cut? This cannot be undone.")) return
    start(async () => {
      const res = await deleteWeightCutAction(cutId, clientId)
      if (res.ok) {
        toast.success("Cut deleted")
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to delete")
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={regenerate}
        disabled={pending}
      >
        <RefreshCw className="size-4" />
        Regenerate
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/clients/${clientId}/combat/edit`}>
          <Pencil className="size-4" />
          Edit
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={remove}
        disabled={pending}
        className="text-destructive"
      >
        Delete
      </Button>
    </div>
  )
}
