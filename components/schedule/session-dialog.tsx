"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { createSessionAction, updateSessionAction } from "@/lib/actions/schedule"
import { NO_CLIENT, NO_MODALITY, SESSION_TYPES, SESSION_MODALITIES, SESSION_TYPE_LABELS, SESSION_MODALITY_LABELS } from "@/lib/validations/schedule"
import type { ActionState } from "@/lib/actions/types"
import type { ScheduledSessionView } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <p className="text-destructive text-xs">{errors[0]}</p>
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (editing ? "Saving…" : "Scheduling…") : editing ? "Save changes" : "Schedule session"}
    </Button>
  )
}

interface SessionDialogProps {
  athletes: { id: string; name: string }[]
  session?: ScheduledSessionView
  trigger?: React.ReactNode
}

export function SessionDialog({ athletes, session, trigger }: SessionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const editing = !!session

  // Bind the update action to the session id when editing.
  const boundUpdate = useMemo(
    () =>
      session
        ? updateSessionAction.bind(null, session.id)
        : null,
    [session]
  )

  const action = editing && boundUpdate ? boundUpdate : createSessionAction

  const [state, formAction] = useActionState<ActionState, FormData>(
    action,
    { ok: false }
  )

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Session updated" : "Session scheduled")
      setOpen(false)
      router.refresh()
    } else if (state.error && state.error !== "") {
      toast.error(state.error)
    }
  }, [state, editing, router])

  // Extract date and time from existing session for defaults
  const defaultDate = session
    ? session.scheduledAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const defaultTime = session
    ? session.scheduledAt.slice(11, 16)
    : "09:00"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Schedule session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit session" : "Schedule session"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the session details below."
              : "Add a new coaching session to your schedule."}
          </DialogDescription>
        </DialogHeader>

        <form
          key={state.ok ? "reset" : editing ? session?.id : "create"}
          action={formAction}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={session?.title ?? ""}
              placeholder="e.g. Morning training session"
              autoFocus
            />
            <FieldError errors={state.fieldErrors?.title} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="clientId">Athlete</Label>
              <Select name="clientId" defaultValue={session?.clientId ?? NO_CLIENT}>
                <SelectTrigger id="clientId">
                  <SelectValue placeholder="General / no athlete" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>General / no athlete</SelectItem>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sessionType">Type</Label>
              <Select name="sessionType" defaultValue={session?.sessionType ?? "training"}>
                <SelectTrigger id="sessionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SESSION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scheduledDate">Date</Label>
              <Input
                id="scheduledDate"
                name="scheduledDate"
                type="date"
                defaultValue={defaultDate}
              />
              <FieldError errors={state.fieldErrors?.scheduledDate} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scheduledTime">Time</Label>
              <Input
                id="scheduledTime"
                name="scheduledTime"
                type="time"
                defaultValue={defaultTime}
              />
              <FieldError errors={state.fieldErrors?.scheduledTime} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="durationMin">Duration (min)</Label>
              <Input
                id="durationMin"
                name="durationMin"
                type="number"
                min={5}
                max={480}
                step={5}
                defaultValue={session?.durationMin ?? 60}
              />
              <FieldError errors={state.fieldErrors?.durationMin} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="modality">Modality</Label>
              <Select name="modality" defaultValue={session?.modality ?? NO_MODALITY}>
                <SelectTrigger id="modality">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MODALITY}>Not specified</SelectItem>
                  {SESSION_MODALITIES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {SESSION_MODALITY_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={session?.location ?? ""}
              placeholder="e.g. Main gym / Zoom link"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={session?.notes ?? ""}
              placeholder="Session agenda, focus areas, reminders…"
            />
          </div>

          <DialogFooter>
            <SubmitButton editing={editing} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
