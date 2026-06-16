"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"

import {
  updateBodyCompositionAction,
  deleteBodyCompositionAction,
} from "@/lib/actions/body-composition"
import type { ActionState } from "@/lib/actions/types"
import type { WeightLog } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const EMPTY: ActionState = { ok: false }

/** ISO → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

const numOrEmpty = (v: number | null) => (v == null ? "" : String(v))

function SaveButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
}

const FIELDS: { name: keyof WeightLog; label: string; step: string }[] = [
  { name: "weight_lbs", label: "Weight (lb)", step: "0.1" },
  { name: "body_fat_pct", label: "Body fat %", step: "0.1" },
  { name: "body_fat_mass_lbs", label: "Body fat mass (lb)", step: "0.1" },
  { name: "skeletal_muscle_mass_lbs", label: "Skeletal muscle (lb)", step: "0.1" },
  { name: "total_body_water_lbs", label: "Total body water (lb)", step: "0.1" },
  { name: "bmr", label: "BMR (kcal)", step: "1" },
]

export function BodyCompRowActions({ clientId, log }: { clientId: string; log: WeightLog }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateBodyCompositionAction.bind(null, clientId, log.id),
    EMPTY
  )

  useEffect(() => {
    if (state.ok) {
      toast.success("Measurement updated")
      setOpen(false)
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function onDelete() {
    if (!confirm("Delete this measurement? This cannot be undone.")) return
    startDelete(async () => {
      const res = await deleteBodyCompositionAction(clientId, log.id)
      if (res.ok) { toast.success("Measurement deleted"); router.refresh() }
      else toast.error(res.error ?? "Delete failed")
    })
  }

  return (
    <div className="flex justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Edit measurement">
            <Pencil className="size-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit measurement</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.name} className="grid gap-1.5">
                  <Label htmlFor={f.name}>{f.label}</Label>
                  <Input
                    id={f.name}
                    name={f.name}
                    type="number"
                    step={f.step}
                    defaultValue={numOrEmpty(log[f.name] as number | null)}
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="logged_at">Date & time</Label>
              <Input
                id="logged_at" name="logged_at" type="datetime-local"
                defaultValue={toLocalInput(log.logged_at)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" defaultValue={log.notes ?? ""} />
            </div>
            <DialogFooter>
              <SaveButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost" size="icon"
        className="text-red-600 hover:text-red-700 dark:text-red-400 size-7"
        aria-label="Delete measurement"
        disabled={deleting}
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
