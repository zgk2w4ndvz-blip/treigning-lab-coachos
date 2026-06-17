"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Activity, Pencil } from "lucide-react"

import { saveLowBasePrescriptionAction } from "@/lib/actions/low-base"
import type { ActionState } from "@/lib/actions/types"
import type { LowBasePrescription } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"

const EMPTY: ActionState = { ok: false }

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
  const [freq, setFreq] = useState(prescription?.frequency_per_week ?? 3)
  const [mins, setMins] = useState(prescription?.minutes_per_session ?? 30)

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
    setFreq(prescription?.frequency_per_week ?? 3)
    setMins(prescription?.minutes_per_session ?? 30)
    setEditing(true)
  }

  // ---- Empty state ---------------------------------------------------------
  if (!editing && !prescription) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            icon={Activity}
            title="No Low Base prescription yet"
            description="Set the athlete's Metabolic Efficiency Point and weekly dose."
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
    const weekly = prescription.frequency_per_week * prescription.minutes_per_session
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
                {prescription.frequency_per_week}
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
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Total Weekly Time
            </p>
            <p className="text-primary text-4xl font-bold tabular-nums">
              {weekly}
              <span className="ml-2 text-xl font-medium">min/week</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {prescription.frequency_per_week} × {prescription.minutes_per_session} min
            </p>
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
  const previewWeekly = (Number(freq) || 0) * (Number(mins) || 0)

  return (
    <Card>
      <CardContent className="p-6">
        <form action={formAction} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="frequency_per_week">Frequency (×/week)</Label>
              <Input
                id="frequency_per_week" name="frequency_per_week" type="number" inputMode="numeric"
                value={freq} onChange={(e) => setFreq(Number(e.target.value))} required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="minutes_per_session">Session time (min)</Label>
              <Input
                id="minutes_per_session" name="minutes_per_session" type="number" inputMode="numeric"
                value={mins} onChange={(e) => setMins(Number(e.target.value))} required
              />
            </div>
          </div>

          <p className="text-sm font-medium">
            Total weekly time:{" "}
            <span className="text-primary tabular-nums">{previewWeekly} min/week</span>
          </p>

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
