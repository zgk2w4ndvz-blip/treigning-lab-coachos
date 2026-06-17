"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRightCircle } from "lucide-react"

import { pushMepToLowBaseAction } from "@/lib/actions/metabolic"
import { Button } from "@/components/ui/button"

/**
 * Pushes an assessment's MEP into the client's Low Base prescription. Disabled
 * when the assessment has no MEP value (nothing to push).
 */
export function PushMepButton({
  clientId,
  assessmentId,
  mep,
}: {
  clientId: string
  assessmentId: string
  mep: number | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function onPush() {
    start(async () => {
      const res = await pushMepToLowBaseAction(clientId, assessmentId)
      if (res.ok) {
        toast.success("MEP pushed to Low Base")
        router.refresh()
      } else {
        toast.error(res.error ?? "Push failed")
      }
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending || mep == null}
      onClick={onPush}
      title={mep == null ? "This assessment has no MEP value" : "Push MEP to Low Base"}
    >
      <ArrowRightCircle className="mr-1.5 size-4" />
      {pending ? "Pushing…" : "Push MEP to Low Base"}
    </Button>
  )
}
