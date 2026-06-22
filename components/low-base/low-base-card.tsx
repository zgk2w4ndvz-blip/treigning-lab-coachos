"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Activity, Pencil, Plus, Trash2, CalendarClock } from "lucide-react"

import { saveLowBasePrescriptionAction } from "@/lib/actions/low-base"
import { parseSchedule, lowBaseEventLabel } from "@/lib/calendar/low-base-sync"
import type { ActionState } from "@/lib/actions/types"
import type { LowBasePrescription } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"

const EMPTY: ActionState = { ok: false }
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface Slot {
  day_of_week: number
  time: string
}

function initialSlots(prescription: LowBasePrescription | null): Slot[] {
  return parseSchedule(prescription?.schedule).map((s) => ({ day_of_week: s.dayOfWeek, time: s.time }))
}

/** "8:00 AM" from "HH:MM". */
function fmtTime(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const period = h < 12 ? "AM" : "PM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  )
}

export function LowBaseCard({
  clientId,
  prescription,
}: {
  clientId: string
  prescription: LowBasePrescription | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveLowBasePrescriptionAction.bind(null, clientId),
    EMPTY
  )

  // Local state powers the live preview while editing.
  const [mep, setMep] = useState(prescription?.mep_bpm ?? 130)
  const [mins, setMins] = useState(prescription?.minutes_per_session ?? 30)
  const [slots, setSlots] = useState<Slot[]>(initialSlots(prescription))
  const [startDate, setStartDate] = useState(prescription?.start_date ?? "")
  const [endDate, setEndDate] = useState(prescription?.end_date ?? "")

  useEffect(() => {
    if (state.ok) {
      toast.success("Low Base prescription saved")
      setEditing(false)
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function startEdit() {
    setMep(prescription?.mep_bpm ?? 130)
    setMins(prescription?.minutes_per_session ?? 30)
    setSlots(initialSlots(prescription))
    setStartDate(prescription?.start_date ?? "")
    setEndDate(prescription?.end_date ?? "")
    setEditing(true)
  }

  function addSlot() {
    if (slots.length >= 7) return
    setSlots((s) => [...s, { day_of_week: 1, time: "08:00" }])
  }
  function removeSlot(i: number) {
    setSlots((s) => s.filter((_, idx) => idx !== i))
  }
  function updateSlot(i: number, patch: Partial<Slot>) {
    setSlots((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  // ---- Empty state ---------------------------------------------------------
  if (!editing && !prescription) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            icon={Activity}
            title="No Low Base prescription yet"
            description="Set the athlete's Metabolic Efficiency Point, weekly dose, and schedule."
          />
          <div className="mt-4 flex justify-center">
            <Button onClick={startEdit}>Set Low Base prescription</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---- View mode -----------------------------------------------------------
  if (!editing && prescription) {
    const hasMep = prescription.mep_bpm != null
    const freq = prescription.frequency_per_week
    const weekly = freq * prescription.minutes_per_session
    const viewSlots = initialSlots(prescription).sort(
      (a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time)
    )
    return (
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Metabolic Efficiency Point (MEP)
              </p>
              <p className="text-primary text-6xl font-bold tabular-nums">
                {hasMep ? prescription.mep_bpm!.toFixed(2) : "—"}
                <span className="text-muted-foreground ml-2 text-2xl font-medium">bpm</span>
              </p>
              <p className="mt-2 text-lg font-semibold">
                {hasMep ? (
                  <>
                    Low Base Range:{" "}
                    <span className="tabular-nums">
                      {(prescription.mep_bpm! - 10).toFixed(2)}–{(prescription.mep_bpm! + 10).toFixed(2)}
                    </span>{" "}
                    bpm
                  </>
                ) : (
                  <span className="text-muted-foreground font-normal">MEP not set — add it to define the range.</span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="size-4" /> Edit
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium">Frequency</p>
              <p className="text-2xl font-bold tabular-nums">
                {freq}
                <span className="text-muted-foreground ml-1 text-base font-medium">×/week</span>
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium">Session time</p>
              <p className="text-2xl font-bold tabular-nums">
                {prescription.minutes_per_session}
                <span className="text-muted-foreground ml-1 text-base font-medium">min</span>
              </p>
            </div>
          </div>

          <div className="bg-primary/10 border-primary/20 rounded-lg border p-4 text-center">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Total Weekly Time</p>
            <p className="text-primary text-4xl font-bold tabular-nums">
              {weekly}
              <span className="ml-2 text-xl font-medium">min/week</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {freq} × {prescription.minutes_per_session} min
            </p>
          </div>

          {/* Schedule + calendar sync */}
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarClock className="text-muted-foreground size-4" />
              <p className="text-sm font-semibold">Weekly schedule</p>
            </div>
            {viewSlots.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No schedule set — add days/times to sync recurring calendar events.
              </p>
            ) : (
              <>
                <ul className="divide-border divide-y text-sm">
                  {viewSlots.map((s, i) => (
                    <li key={i} className="flex items-center justify-between py-1.5">
                      <span className="font-medium">{DAY_LONG[s.day_of_week]}</span>
                      <span className="tabular-nums">{fmtTime(s.time)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-3 text-xs">
                  Calendar events:{" "}
                  <span className="text-foreground font-medium">
                    {lowBaseEventLabel(prescription.minutes_per_session, prescription.mep_bpm)}
                  </span>
                  {prescription.start_date ? ` · from ${prescription.start_date}` : ""}
                  {prescription.end_date ? ` · until ${prescription.end_date}` : " · ongoing"}
                </p>
              </>
            )}
          </div>

          {prescription.notes ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{prescription.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  // ---- Edit mode -----------------------------------------------------------
  const previewLow = (Number.isFinite(mep) ? mep - 10 : 0).toFixed(2)
  const previewHigh = (Number.isFinite(mep) ? mep + 10 : 0).toFixed(2)
  const effectiveFreq = slots.length > 0 ? slots.length : 0
  const previewWeekly = effectiveFreq * (Number(mins) || 0)

  return (
    <Card>
      <CardContent className="p-6">
        <form action={formAction} className="space-y-4">
          {/* Schedule is posted as a JSON array of { day_of_week, time }. */}
          <input type="hidden" name="schedule" value={JSON.stringify(slots)} />
          {/* Frequency is derived from the schedule; kept for the prescription row. */}
          <input type="hidden" name="frequency_per_week" value={Math.max(effectiveFreq, 1)} />

          <div className="grid gap-1.5">
            <Label htmlFor="mep_bpm">MEP — Metabolic Efficiency Point (bpm)</Label>
            <Input
              id="mep_bpm" name="mep_bpm" type="number" inputMode="decimal" step="0.01"
              value={mep} onChange={(e) => setMep(Number(e.target.value))} required
            />
            <p className="text-muted-foreground text-xs">
              Low Base Range: <span className="tabular-nums">{previewLow}–{previewHigh}</span> bpm
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="minutes_per_session">Minutes per session</Label>
            <Input
              id="minutes_per_session" name="minutes_per_session" type="number" inputMode="numeric"
              value={mins} onChange={(e) => setMins(Number(e.target.value))} required
              className="max-w-40"
            />
          </div>

          {/* Scheduling section */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="text-muted-foreground size-4" />
              <p className="text-sm font-semibold">Scheduling</p>
              <span className="text-muted-foreground text-xs">syncs recurring calendar events</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="start_date">Start date</Label>
                <Input
                  id="start_date" name="start_date" type="date"
                  value={startDate} onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="end_date">End date (optional)</Label>
                <Input
                  id="end_date" name="end_date" type="date"
                  value={endDate} onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Weekly sessions ({slots.length}/7)</Label>
              {slots.length === 0 ? (
                <p className="text-muted-foreground text-sm">No sessions yet — add one to schedule.</p>
              ) : (
                <ul className="space-y-2">
                  {slots.map((s, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <select
                        aria-label="Day of week"
                        value={s.day_of_week}
                        onChange={(e) => updateSlot(i, { day_of_week: Number(e.target.value) })}
                        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                      >
                        {DAY_NAMES.map((d, idx) => (
                          <option key={idx} value={idx}>{DAY_LONG[idx]}</option>
                        ))}
                      </select>
                      <Input
                        aria-label="Start time"
                        type="time"
                        value={s.time}
                        onChange={(e) => updateSlot(i, { time: e.target.value })}
                        className="h-9 max-w-32"
                      />
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSlot(i)} aria-label="Remove session">
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addSlot} disabled={slots.length >= 7}>
                <Plus className="size-4" /> Add session
              </Button>
            </div>

            {slots.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                Creates{" "}
                <span className="text-foreground font-medium">
                  {lowBaseEventLabel(Number(mins) || 0, Number.isFinite(mep) ? mep : null)}
                </span>{" "}
                events · {previewWeekly} min/week
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={prescription?.notes ?? ""} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <SaveButton />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
