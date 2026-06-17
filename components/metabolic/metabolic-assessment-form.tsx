"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { logMetabolicAssessmentAction } from "@/lib/actions/metabolic"
import type { ActionState } from "@/lib/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PointRow {
  intensity: string
  heart_rate_bpm: string
  ventilation_l_min: string
  vo2: string
}

const EMPTY_ROW: PointRow = {
  intensity: "",
  heart_rate_bpm: "",
  ventilation_l_min: "",
  vo2: "",
}

const SCALARS: { name: string; label: string; step: string }[] = [
  { name: "vo2_max", label: "VO₂ Max (ml/kg/min)", step: "0.1" },
  { name: "mep_bpm", label: "MEP (bpm)", step: "0.01" },
  { name: "aerobic_threshold_bpm", label: "Aerobic Threshold (bpm)", step: "0.01" },
  { name: "max_hr_bpm", label: "Max HR (bpm)", step: "1" },
]

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
  const [rows, setRows] = useState<PointRow[]>([{ ...EMPTY_ROW }])
  const [state, formAction] = useActionState<ActionState, FormData>(
    logMetabolicAssessmentAction.bind(null, clientId),
    { ok: false }
  )

  useEffect(() => {
    if (state.ok) {
      toast.success("Assessment saved")
      formRef.current?.reset()
      setRows([{ ...EMPTY_ROW }])
      router.refresh()
    } else if (state.error) {
      toast.error(state.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Serialize non-empty rows (those with at least one value) into curve points.
  const pointsJson = JSON.stringify(
    rows
      .map((r, i) => ({
        stage: i,
        intensity: num(r.intensity),
        heart_rate_bpm: num(r.heart_rate_bpm),
        ventilation_l_min: num(r.ventilation_l_min),
        vo2: num(r.vo2),
      }))
      .filter(
        (p) =>
          p.intensity != null ||
          p.heart_rate_bpm != null ||
          p.ventilation_l_min != null ||
          p.vo2 != null
      )
  )

  function updateRow(idx: number, key: keyof PointRow, value: string) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log metabolic assessment</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="points" value={pointsJson} />

          <div className="grid grid-cols-2 gap-3">
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
            <p className="text-sm font-medium">Curve points</p>
            <div className="text-muted-foreground grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 px-1 text-[11px]">
              <span>Intensity</span>
              <span>HR (bpm)</span>
              <span>VE (L/min)</span>
              <span>VO₂</span>
              <span className="w-7" />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-2">
                <Input
                  type="number" step="0.1" aria-label={`Intensity row ${i + 1}`}
                  value={r.intensity}
                  onChange={(e) => updateRow(i, "intensity", e.target.value)}
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
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setRows((rs) => [...rs, { ...EMPTY_ROW }])}
            >
              <Plus className="mr-1 size-3.5" /> Add point
            </Button>
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
