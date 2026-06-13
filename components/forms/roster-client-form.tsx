"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import type { ActionState } from "@/lib/actions/types"
import type { ImportedAthlete } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string
  name: string
  errors?: Record<string, string[]>
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.[name]?.length ? (
        <p className="text-destructive text-sm">{errors[name][0]}</p>
      ) : null}
    </div>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  )
}

export function RosterClientForm({
  action,
  defaultValues,
  submitLabel = "Save client",
}: {
  action: FormAction
  defaultValues?: ImportedAthlete | null
  submitLabel?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {
    ok: false,
  })
  const errors = state.fieldErrors
  const d = defaultValues

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Athlete details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="first_name" errors={errors}>
            <Input id="first_name" name="first_name" defaultValue={d?.firstName ?? ""} required />
          </Field>
          <Field label="Last name" name="last_name" errors={errors}>
            <Input id="last_name" name="last_name" defaultValue={d?.lastName ?? ""} required />
          </Field>
          <Field label="Email" name="email" errors={errors}>
            <Input id="email" name="email" type="email" defaultValue={d?.email ?? ""} />
          </Field>
          <Field label="Phone" name="phone" errors={errors}>
            <Input id="phone" name="phone" defaultValue={d?.phone ?? ""} />
          </Field>
          <Field label="Sport" name="sport" errors={errors}>
            <Input id="sport" name="sport" defaultValue={d?.sport ?? ""} placeholder="Wrestling" />
          </Field>
          <Field label="Weight class" name="weight_class" errors={errors}>
            <Input id="weight_class" name="weight_class" defaultValue={d?.weightClass ?? ""} placeholder="157" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight &amp; competition</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Current weight (lb)" name="current_weight" errors={errors}>
            <Input id="current_weight" name="current_weight" type="number" step="0.1" defaultValue={d?.currentWeight ?? ""} />
          </Field>
          <Field label="Goal weight (lb)" name="goal_weight" errors={errors}>
            <Input id="goal_weight" name="goal_weight" type="number" step="0.1" defaultValue={d?.goalWeight ?? ""} />
          </Field>
          <Field label="Next competition" name="next_competition" errors={errors}>
            <Input id="next_competition" name="next_competition" defaultValue={d?.nextCompetition ?? ""} placeholder="Regional Duals" />
          </Field>
          <Field label="Competition date" name="competition_date" errors={errors}>
            <Input id="competition_date" name="competition_date" type="date" defaultValue={d?.competitionDate ?? ""} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Coach notes" name="coach_notes" errors={errors}>
              <Textarea id="coach_notes" name="coach_notes" rows={3} defaultValue={d?.coachNotes ?? ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  )
}
