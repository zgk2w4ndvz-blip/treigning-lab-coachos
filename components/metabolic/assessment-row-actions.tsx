"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { deleteMetabolicAssessmentAction } from "@/lib/actions/metabolic"
import { Button } from "@/components/ui/button"

export function AssessmentRowActions({
  clientId,
  assessmentId,
}: {
  clientId: string
  assessmentId: string
}) {
  const router = useRouter()
  const [deleting, startDelete] = useTransition()

  function onDelete() {
    if (!confirm("Delete this assessment? Its curve points are removed too.")) return
    startDelete(async () => {
      const res = await deleteMetabolicAssessmentAction(clientId, assessmentId)
      if (res.ok) {
        toast.success("Assessment deleted")
        router.refresh()
      } else {
        toast.error(res.error ?? "Delete failed")
      }
    })
  }

  return (
    <div className="flex justify-end">
      <Button
        variant="ghost" size="icon"
        className="text-red-600 hover:text-red-700 dark:text-red-400 size-7"
        aria-label="Delete assessment"
        disabled={deleting}
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
