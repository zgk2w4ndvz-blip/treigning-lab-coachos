"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Copy, Trash2 } from "lucide-react"

import {
  createCalendarEventAction,
  updateCalendarEventAction,
  deleteCalendarEventAction,
  duplicateCalendarEventAction,
} from "@/lib/actions/athlete-calendar"
import { CALENDAR_CATEGORIES } from "@/lib/validations/athlete-calendar"
import { CATEGORY_META } from "@/lib/calendar/categories"
import { instantToZonedInput } from "@/lib/calendar/timezone"
import type { ActionState } from "@/lib/actions/types"
import type { AthleteCalendarEvent } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const EMPTY: ActionState = { ok: false }

function SaveButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
}

export function CalendarEventDialog({
  clientId,
  open,
  onOpenChange,
  event,
  defaultDate,
  timeZone,
}: {
  clientId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  event: AthleteCalendarEvent | null
  defaultDate: string | null // yyyy-MM-dd for new events
  timeZone: string
}) {
  const router = useRouter()
  const [, startTx] = useTransition()
  const action = event
    ? updateCalendarEventAction.bind(null, clientId, event.id)
    : createCalendarEventAction.bind(null, clientId)
  const [state, formAction] = useActionState<ActionState, FormData>(action, EMPTY)
  // Remount the form when switching between events so defaults refresh.
  const [formKey, setFormKey] = useState(0)
  useEffect(() => setFormKey((k) => k + 1), [event?.id, open])

  useEffect(() => {
    if (state.ok) {
      toast.success(event ? "Event updated" : "Event created")
      onOpenChange(false)
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const startDefault = event
    ? instantToZonedInput(event.starts_at, timeZone)
    : defaultDate
      ? `${defaultDate}T07:00`
      : instantToZonedInput(new Date().toISOString(), timeZone)

  function runSimple(fn: () => Promise<ActionState>, okMsg: string) {
    startTx(async () => {
      const res = await fn()
      if (res.ok) { toast.success(okMsg); onOpenChange(false); router.refresh() }
      else toast.error(res.error ?? "Failed")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New calendar event"}</DialogTitle>
        </DialogHeader>

        <form key={formKey} action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={event?.title ?? ""} placeholder="e.g. Lower body strength" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <select
                id="category" name="category" defaultValue={event?.category ?? "strength"}
                className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm"
              >
                {CALENDAR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="status">
                Status{event && event.recurrence !== "none" ? " (series default)" : ""}
              </Label>
              <select
                id="status" name="status" defaultValue={event?.status ?? "planned"}
                className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm"
              >
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
                <option value="missed">Missed</option>
              </select>
              {event && event.recurrence !== "none" ? (
                <p className="text-muted-foreground text-[11px]">
                  Sets the default for every occurrence. To mark one day, use the
                  event&apos;s menu on the calendar.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="starts_at">Start</Label>
              <Input id="starts_at" name="starts_at" type="datetime-local" defaultValue={startDefault} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ends_at">End (optional)</Label>
              <Input id="ends_at" name="ends_at" type="datetime-local" defaultValue={instantToZonedInput(event?.ends_at ?? null, timeZone)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="all_day" defaultChecked={event ? event.all_day : true} className="size-4" />
            All-day
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="recurrence">Repeat</Label>
              <select
                id="recurrence" name="recurrence" defaultValue={event?.recurrence ?? "none"}
                className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recurrence_until">Repeat until</Label>
              <Input id="recurrence_until" name="recurrence_until" type="date" defaultValue={event?.recurrence_until ?? ""} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="description">Notes / prescription detail</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={event?.description ?? ""} />
          </div>

          <DialogFooter className="gap-2">
            {event ? (
              <div className="mr-auto flex gap-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => runSimple(() => duplicateCalendarEventAction(clientId, event.id), "Duplicated")}>
                  <Copy className="size-4" /> Duplicate
                </Button>
                <Button type="button" variant="outline" size="sm"
                  className="text-red-600 dark:text-red-400"
                  onClick={() => {
                    if (confirm("Delete this event?")) runSimple(() => deleteCalendarEventAction(clientId, event.id), "Deleted")
                  }}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            ) : null}
            <SaveButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
