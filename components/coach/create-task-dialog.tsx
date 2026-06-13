"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { createTaskAction } from "@/lib/actions/tasks"
import type { ActionState } from "@/lib/actions/types"
import { NO_CLIENT, PRIORITIES, TASK_TYPES } from "@/lib/validations/tasks"
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

const TYPE_LABELS: Record<(typeof TASK_TYPES)[number], string> = {
  nutrition: "Nutrition",
  hydration: "Hydration",
  supplements: "Supplements",
  recovery: "Recovery",
  weight_cut: "Weight cut",
  competition: "Competition",
  communication: "Comms",
  training: "Training",
  general: "General",
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <p className="text-destructive text-xs">{errors[0]}</p>
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create task"}
    </Button>
  )
}

export function CreateTaskDialog({
  athletes,
}: {
  athletes: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState<ActionState, FormData>(
    createTaskAction,
    { ok: false }
  )

  useEffect(() => {
    if (state.ok) {
      toast.success("Task created")
      setOpen(false)
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Add a coaching to-do. Assign it to an athlete or leave it general.
          </DialogDescription>
        </DialogHeader>

        {/* key resets the uncontrolled fields after each successful create */}
        <form key={state.ok ? "reset" : "edit"} action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="e.g. Review weekly check-in" autoFocus />
            <FieldError errors={state.fieldErrors?.title} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Optional details" />
            <FieldError errors={state.fieldErrors?.description} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="clientId">Athlete</Label>
              <Select name="clientId" defaultValue={NO_CLIENT}>
                <SelectTrigger id="clientId">
                  <SelectValue placeholder="General (no athlete)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>General (no athlete)</SelectItem>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="general">
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
              <FieldError errors={state.fieldErrors?.dueDate} />
            </div>
          </div>

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
