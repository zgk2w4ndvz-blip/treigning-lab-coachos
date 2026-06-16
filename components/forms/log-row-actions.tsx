"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"

import type { ActionState } from "@/lib/actions/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const EMPTY: ActionState = { ok: false }

export type EditField = {
  name: string
  label: string
  type?: "text" | "number" | "date" | "datetime-local" | "select" | "checkbox"
  step?: string
  options?: { value: string; label: string }[]
  defaultValue?: string | number | null
  full?: boolean
}

function SaveButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
}

/** ISO datetime → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

function FieldInput({ f }: { f: EditField }) {
  const raw = f.defaultValue == null ? "" : String(f.defaultValue)
  // A full ISO string (len > 16) needs converting to the datetime-local format.
  const dv = f.type === "datetime-local" && raw.length > 16 ? toLocalInput(raw) : raw
  if (f.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={f.name} defaultChecked={dv === "on" || dv === "true"} className="size-4" />
        {f.label}
      </label>
    )
  }
  if (f.type === "select") {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={f.name}>{f.label}</Label>
        <select
          id={f.name} name={f.name} defaultValue={dv}
          className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm"
        >
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={f.name}>{f.label}</Label>
      <Input id={f.name} name={f.name} type={f.type ?? "text"} step={f.step} defaultValue={dv} />
    </div>
  )
}

/**
 * Per-row edit (dialog) + delete (with confirm) for a coach-entered log row.
 * `updateAction` / `deleteAction` are server actions already bound to the
 * (clientId, rowId) so RLS scopes the write to the owning coach.
 */
export function LogRowActions({
  title,
  fields,
  updateAction,
  deleteAction,
}: {
  title: string
  fields: EditField[]
  updateAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  deleteAction: () => Promise<ActionState>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const [state, formAction] = useActionState<ActionState, FormData>(updateAction, EMPTY)

  useEffect(() => {
    if (state.ok) {
      toast.success("Updated")
      setOpen(false)
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function onDelete() {
    if (!confirm("Delete this entry? This cannot be undone.")) return
    startDelete(async () => {
      const res = await deleteAction()
      if (res.ok) { toast.success("Deleted"); router.refresh() }
      else toast.error(res.error ?? "Delete failed")
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Edit entry">
            <Pencil className="size-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <form action={formAction} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.name} className={cn(f.full && "col-span-2")}>
                  <FieldInput f={f} />
                </div>
              ))}
            </div>
            <DialogFooter><SaveButton /></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost" size="icon"
        className="text-red-600 hover:text-red-700 dark:text-red-400 size-7"
        aria-label="Delete entry" disabled={deleting} onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
