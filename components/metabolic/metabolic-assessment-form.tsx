"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { logMetabolicAssessmentAction } from "@/lib/actions/metabolic"
import type { ActionState } from "@/lib/actions/types"
import type { MetabolicCurvePhase } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PointRow {
  phase: MetabolicCurvePhase
  elapsed_sec: string
  heart_rate_bpm: string
  ventilation_l_min: string
  vo2: string
}

const emptyRow = (phase: MetabolicCurvePhase): PointRow => ({
  phase,
  elapsed_sec: "",
  heart_rate_bpm: "",
  ventilation_l_min: "",
  vo2: "",
})

const SCALARS: { name: string; label: string; step: string }[] = [
  { name: "vo2_max", label: "VO₂ Max (ml/kg/min)", step: "0.01" },
  { name: "mep_bpm", label: "Set Point (bpm)", step: "0.01" },
  { name: "max_hr_bpm", label: "Max HR (bpm)", step: "1" },
  { name: "aerobic_threshold_bpm", label: "Aerobic (bpm)", step: "0.01" },
  { name: "calories_burned_per_min", label: "Calories Burned/min", step: "0.1" },
]

const selectClass =
  "border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save assessment"}
    </Button>
  )
}

const num = (s: string) => (s.trim() === "" ? null : Number(s))

export function MetabolicAssessmentForm({ clientId }: { clientId: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [rows, setRows] = useState<PointRow[]>([emptyRow("increase")])
  const [state, formAction] = useActionState<ActionState, FormData>(
    logMetabolicAssessmentAction.bind(null, clientId),
    { ok: false }
  )

  useEffect(() => {
    if (state.ok) {
      toast.success("Assessment saved")
      formRef.current?.reset()
      setRows([emptyRow("increase")])
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Serialize rows that carry at least one measured value into curve points.
  const pointsJson = JSON.stringify(
    rows
      .map((r, i) => ({
        phase: r.phase,
        stage: i,
        elapsed_sec: num(r.elapsed_sec),
        heart_rate_bpm: num(r.heart_rate_bpm),
        ventilation_l_min: num(r.ventilation_l_min),
        vo2: num(r.vo2),
      }))
      .filter(
        (p) =>
          p.elapsed_sec != null ||
          p.heart_rate_bpm != null ||
          p.ventilation_l_min != null ||
          p.vo2 != null
      )
  )

  function updateRow(idx: number, key: keyof PointRow, value: string) {
    setRows((rs) =>
      rs.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log assessment</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="points" value={pointsJson} />

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="source">Source</Label>
              <select id="source" name="source" className={selectClass} defaultValue="manual_cart">
                <option value="manual_cart">Manual Cart</option>
                <option value="cart">Cart</option>
              </select>
            </div>
            {SCALARS.map((f) => (
              <div key={f.name} className="grid gap-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input id={f.name} name={f.name} type="number" step={f.step} />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label htmlFor="assessed_at">Date & time</Label>
              <Input id="assessed_at" name="assessed_at" type="datetime-local" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Curve samples</p>
            <div className="text-muted-foreground grid grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_auto] gap-2 px-1 text-[11px]">
              <span>Phase</span>
              <span>Time (s)</span>
              <span>HR (bpm)</span>
              <span>VE (L/min)</span>
              <span>VO₂</span>
              <span className="w-7" />
            </div>
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_auto] items-center gap-2"
              >
                <select
                  className={selectClass}
                  aria-label={`Phase row ${i + 1}`}
                  value={r.phase}
                  onChange={(e) => updateRow(i, "phase", e.target.value)}
                >
                  <option value="increase">Increase</option>
                  <option value="decrease">Decrease</option>
                </select>
                <Input
                  type="number" step="0.1" aria-label={`Time row ${i + 1}`}
                  value={r.elapsed_sec}
                  onChange={(e) => updateRow(i, "elapsed_sec", e.target.value)}
                />
                <Input
                  type="number" step="0.1" aria-label={`Heart rate row ${i + 1}`}
                  value={r.heart_rate_bpm}
                  onChange={(e) => updateRow(i, "heart_rate_bpm", e.target.value)}
                />
                <Input
                  type="number" step="0.1" aria-label={`Ventilation row ${i + 1}`}
                  value={r.ventilation_l_min}
                  onChange={(e) => updateRow(i, "ventilation_l_min", e.target.value)}
                />
                <Input
                  type="number" step="0.1" aria-label={`VO2 row ${i + 1}`}
                  value={r.vo2}
                  onChange={(e) => updateRow(i, "vo2", e.target.value)}
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  className="text-muted-foreground hover:text-red-600 size-7"
                  aria-label={`Remove row ${i + 1}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setRows((rs) => [...rs, emptyRow("increase")])}
              >
                <Plus className="mr-1 size-3.5" /> Increase point
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setRows((rs) => [...rs, emptyRow("decrease")])}
              >
                <Plus className="mr-1 size-3.5" /> Decrease point
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
