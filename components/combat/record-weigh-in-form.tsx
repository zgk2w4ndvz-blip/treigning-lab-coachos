"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import type { ActionState } from "@/lib/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Log weigh-in"}
    </Button>
  )
}

export function RecordWeighInForm({
  action,
  defaultTargetLbs,
}: {
  action: FormAction
  defaultTargetLbs?: number | null
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {
    ok: false,
  })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) {
      toast.success("Weigh-in logged")
      formRef.current?.reset()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log a weigh-in</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="kind">Type</Label>
            <select
              id="kind"
              name="kind"
              defaultValue="check_in"
              className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs"
            >
              <option value="check_in">Check-in</option>
              <option value="official">Official</option>
              <option value="unofficial">Unofficial</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scheduled_at">Date &amp; time</Label>
            <Input
              id="scheduled_at"
              name="scheduled_at"
              type="datetime-local"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="target_lbs">Target (lb)</Label>
            <Input
              id="target_lbs"
              name="target_lbs"
              type="number"
              step="0.1"
              defaultValue={defaultTargetLbs ?? undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="weight_lbs">Actual (lb)</Label>
            <Input
              id="weight_lbs"
              name="weight_lbs"
              type="number"
              step="0.1"
              placeholder="leave blank if scheduled"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
