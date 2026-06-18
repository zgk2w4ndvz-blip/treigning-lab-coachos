"use client"

import { useActionState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { saveWeightPlanAction, deleteWeightPlanAction } from "@/lib/actions/weight-plan"
import type { ActionState } from "@/lib/actions/types"
import type { WeightPlan } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const EMPTY: ActionState = { ok: false }

const numOrEmpty = (v: number | null | undefined) => (v == null ? "" : String(v))

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save plan"}
    </Button>
  )
}

export function WeightPlanForm({
  clientId,
  plan,
  defaults,
}: {
  clientId: string
  plan: WeightPlan | null
  defaults: { current_weight: number | null; goal_weight: number | null }
}) {
  const router = useRouter()
  const [deleting, startDelete] = useTransition()
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveWeightPlanAction.bind(null, clientId),
    EMPTY
  )

  useEffect(() => {
    if (state.ok) {
      toast.success("Weight plan saved")
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function onDelete() {
    if (!plan) return
    if (!confirm("Delete this weight plan? Its weekly targets are removed too.")) return
    startDelete(async () => {
      const res = await deleteWeightPlanAction(clientId, plan.id)
      if (res.ok) { toast.success("Weight plan deleted"); router.refresh() }
      else toast.error(res.error ?? "Delete failed")
    })
  }

  const fe = state.fieldErrors ?? {}
  const today = new Date().toISOString().slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{plan ? "Edit weight plan" : "Create weight plan"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field name="current_weight" label="Current weight (lb)" error={fe.current_weight}
              defaultValue={numOrEmpty(plan?.current_weight ?? defaults.current_weight)} step="0.1" required />
            <Field name="goal_weight" label="Goal weight (lb)" error={fe.goal_weight}
              defaultValue={numOrEmpty(plan?.goal_weight ?? defaults.goal_weight)} step="0.1" required />
            <Field name="competition_weight" label="Competition weight (lb)" error={fe.competition_weight}
              defaultValue={numOrEmpty(plan?.competition_weight)} step="0.1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date"
                defaultValue={plan?.start_date ?? today} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="target_date">Target date</Label>
              <Input id="target_date" name="target_date" type="date"
                defaultValue={plan?.target_date ?? ""} />
              {fe.target_date ? <p className="text-xs text-red-600">{fe.target_date[0]}</p> : null}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={plan?.notes ?? ""} />
          </div>
          <div className="flex items-center justify-between">
            {plan ? (
              <Button type="button" variant="outline" size="sm"
                className="text-red-600 dark:text-red-400" disabled={deleting} onClick={onDelete}>
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : <span />}
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({
  name, label, defaultValue, step, required, error,
}: {
  name: string
  label: string
  defaultValue: string
  step?: string
  required?: boolean
  error?: string[]
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step={step} required={required} defaultValue={defaultValue} />
      {error ? <p className="text-xs text-red-600">{error[0]}</p> : null}
    </div>
  )
}
