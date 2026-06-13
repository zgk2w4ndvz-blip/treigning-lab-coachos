"use client"

import { useActionState, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { format, parseISO } from "date-fns"

import type { ActionState } from "@/lib/actions/types"
import { DISCIPLINE_LABELS } from "@/lib/combat/protocols"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  Competition,
  CombatDiscipline,
  WeightClass,
  WeightCut,
} from "@/types/models"

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ""
  }
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  )
}

const DISCIPLINES = Object.keys(DISCIPLINE_LABELS) as CombatDiscipline[]

export function WeightCutForm({
  action,
  clientId,
  weightClasses,
  competitions = [],
  defaultValues,
  submitLabel = "Create cut",
}: {
  action: FormAction
  clientId: string
  weightClasses: WeightClass[]
  competitions?: Competition[]
  defaultValues?: Partial<WeightCut>
  submitLabel?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {
    ok: false,
  })
  const errors = state.fieldErrors
  const d = defaultValues ?? {}

  const [discipline, setDiscipline] = useState<CombatDiscipline>(
    (d.discipline as CombatDiscipline) ?? "mma"
  )
  const [classId, setClassId] = useState<string>(d.weight_class_id ?? "")
  const [className, setClassName] = useState<string>(d.class_name ?? "")
  const [classLimit, setClassLimit] = useState<string>(
    d.class_limit_lbs != null ? String(d.class_limit_lbs) : ""
  )
  const [target, setTarget] = useState<string>(
    d.target_weigh_in_lbs != null ? String(d.target_weigh_in_lbs) : ""
  )

  const classesForDiscipline = useMemo(
    () => weightClasses.filter((c) => c.discipline === discipline),
    [weightClasses, discipline]
  )

  function onPickClass(id: string) {
    setClassId(id)
    const wc = weightClasses.find((c) => c.id === id)
    if (wc) {
      setClassName(`${wc.name}${wc.gender ? ` (${wc.gender})` : ""}`)
      setClassLimit(String(wc.limit_lbs))
      if (!target) setTarget(String(wc.limit_lbs))
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="client_id" value={clientId} />

      {state.error ? (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight class &amp; target</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="discipline">Discipline</Label>
            <select
              id="discipline"
              name="discipline"
              value={discipline}
              onChange={(e) => {
                setDiscipline(e.target.value as CombatDiscipline)
                setClassId("")
              }}
              className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs"
            >
              {DISCIPLINES.map((disc) => (
                <option key={disc} value={disc}>
                  {DISCIPLINE_LABELS[disc]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="weight_class_id">Weight class</Label>
            <select
              id="weight_class_id"
              name="weight_class_id"
              value={classId}
              onChange={(e) => onPickClass(e.target.value)}
              className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs"
            >
              <option value="">Custom / none</option>
              {classesForDiscipline.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.gender ? ` (${c.gender})` : ""} — {c.limit_lbs} lb
                  {c.federation ? ` · ${c.federation}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="class_name">Class name</Label>
            <Input
              id="class_name"
              name="class_name"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="class_limit_lbs">Class limit (lb)</Label>
            <Input
              id="class_limit_lbs"
              name="class_limit_lbs"
              type="number"
              step="0.1"
              value={classLimit}
              onChange={(e) => setClassLimit(e.target.value)}
              required
            />
            {errors?.class_limit_lbs?.length ? (
              <p className="text-destructive text-sm">
                {errors.class_limit_lbs[0]}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="target_weigh_in_lbs">Target weigh-in (lb)</Label>
            <Input
              id="target_weigh_in_lbs"
              name="target_weigh_in_lbs"
              type="number"
              step="0.1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
            {errors?.target_weigh_in_lbs?.length ? (
              <p className="text-destructive text-sm">
                {errors.target_weigh_in_lbs[0]}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={d.status ?? "planning"}
              className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="peak_week">Peak week</option>
              <option value="weigh_in">Weigh-in</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bodyweight &amp; schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="walk_around_lbs">Walk-around (lb)</Label>
            <Input
              id="walk_around_lbs"
              name="walk_around_lbs"
              type="number"
              step="0.1"
              defaultValue={d.walk_around_lbs ?? undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="camp_start_lbs">Camp start (lb)</Label>
            <Input
              id="camp_start_lbs"
              name="camp_start_lbs"
              type="number"
              step="0.1"
              defaultValue={d.camp_start_lbs ?? undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="weigh_in_at">Weigh-in date &amp; time</Label>
            <Input
              id="weigh_in_at"
              name="weigh_in_at"
              type="datetime-local"
              defaultValue={toLocalInput(d.weigh_in_at)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="competition_at">Competition date &amp; time</Label>
            <Input
              id="competition_at"
              name="competition_at"
              type="datetime-local"
              defaultValue={toLocalInput(d.competition_at)}
            />
          </div>
          {competitions.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="competition_id">Link competition</Label>
              <select
                id="competition_id"
                name="competition_id"
                defaultValue={d.competition_id ?? ""}
                className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs"
              >
                <option value="">None</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="cut_method">Cut method</Label>
            <Input
              id="cut_method"
              name="cut_method"
              placeholder="water load, sauna, etc."
              defaultValue={d.cut_method ?? undefined}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={d.notes ?? undefined}
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Water-load, rehydration, and refuel protocols are generated
        automatically from the weigh-in &amp; competition times.
      </p>

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  )
}
