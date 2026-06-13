"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import {
  Check,
  Droplets,
  Moon,
  Pill,
  Scale,
  UtensilsCrossed,
} from "lucide-react"

import {
  addHydrationAction,
  logNutritionAction,
  logRecoveryAction,
  logWeightAction,
  toggleSupplementAction,
} from "@/lib/actions/athlete"
import type { ActionState } from "@/lib/actions/types"
import type { AthleteToday } from "@/types/models"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ComplianceBar } from "@/components/shared/compliance-bar"

const EMPTY: ActionState = { ok: false }

// ---- shared bits -----------------------------------------------------------

function DomainCard({
  title,
  icon: Icon,
  done,
  summary,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  done: boolean
  summary?: string | null
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground size-4" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {done ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            {summary ?? "Done"}
          </span>
        ) : summary ? (
          <span className="text-muted-foreground text-xs">{summary}</span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  )
}

function useEntryToast(state: ActionState, onOk?: () => void) {
  useEffect(() => {
    if (state.ok) {
      toast.success("Logged")
      onOk?.()
    } else if (state.error) {
      toast.error(state.error)
    }
    // onOk identity is stable enough for this use; depend on state only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}

// ---- weight ----------------------------------------------------------------

export function WeightEntry({ data }: { data: AthleteToday["weight"] }) {
  const [state, action] = useActionState(logWeightAction, EMPTY)
  const ref = useRef<HTMLFormElement>(null)
  useEntryToast(state, () => ref.current?.reset())

  const target =
    data.target != null
      ? `Target ${data.target} lb${data.direction ? ` · ${data.direction}` : ""}`
      : "No weight goal set"

  return (
    <DomainCard
      title="Body weight"
      icon={Scale}
      done={data.loggedLbs != null}
      summary={data.loggedLbs != null ? `${data.loggedLbs} lb` : null}
    >
      <p className="text-muted-foreground text-xs">{target}</p>
      <form ref={ref} action={action} className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="weight_lbs" className="text-xs">
            This morning (lb)
          </Label>
          <Input
            id="weight_lbs"
            name="weight_lbs"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="e.g. 181.2"
          />
        </div>
        <SubmitButton label="Log" />
      </form>
    </DomainCard>
  )
}

// ---- hydration -------------------------------------------------------------

const PRESETS = [8, 16, 24]

export function HydrationEntry({ data }: { data: AthleteToday["hydration"] }) {
  const [state, action] = useActionState(addHydrationAction, EMPTY)
  const inputRef = useRef<HTMLInputElement>(null)
  useEntryToast(state)

  const pct = data.targetOz
    ? Math.min(100, Math.round((data.consumedOz / data.targetOz) * 100))
    : data.consumedOz > 0
      ? 100
      : 0
  const done = data.targetOz != null && data.consumedOz >= data.targetOz

  return (
    <DomainCard
      title="Hydration"
      icon={Droplets}
      done={done}
      summary={`${Math.round(data.consumedOz)}${data.targetOz ? ` / ${data.targetOz}` : ""} oz`}
    >
      <ComplianceBar score={pct} />
      <form action={action} className="flex items-end gap-2">
        <div className="flex gap-1.5">
          {PRESETS.map((oz) => (
            <Button
              key={oz}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = String(oz)
              }}
            >
              +{oz}
            </Button>
          ))}
        </div>
        <Input
          ref={inputRef}
          name="oz"
          type="number"
          inputMode="numeric"
          defaultValue={16}
          aria-label="Ounces to add"
          className="w-20"
        />
        <SubmitButton label="Add" />
      </form>
    </DomainCard>
  )
}

// ---- nutrition -------------------------------------------------------------

function MacroTarget({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="text-muted-foreground text-[11px]">
      {label} {value != null ? value : "—"}
    </span>
  )
}

export function NutritionEntry({ data }: { data: AthleteToday["nutrition"] }) {
  const [state, action] = useActionState(logNutritionAction, EMPTY)
  const ref = useRef<HTMLFormElement>(null)
  useEntryToast(state, () => ref.current?.reset())

  const logged = data.calories != null
  const calPct =
    data.caloriesTarget && data.calories != null
      ? Math.min(100, Math.round((data.calories / data.caloriesTarget) * 100))
      : null

  return (
    <DomainCard
      title="Nutrition"
      icon={UtensilsCrossed}
      done={logged}
      summary={logged ? `${data.calories} kcal` : null}
    >
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        <MacroTarget label="kcal" value={data.caloriesTarget} />
        <MacroTarget label="P" value={data.proteinTarget} />
        <MacroTarget label="C" value={data.carbsTarget} />
        <MacroTarget label="F" value={data.fatTarget} />
      </div>
      {calPct != null ? <ComplianceBar score={calPct} /> : null}
      <form ref={ref} action={action} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="calories" className="text-xs">
              Calories
            </Label>
            <Input id="calories" name="calories" type="number" inputMode="numeric" defaultValue={data.calories ?? ""} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="protein" className="text-xs">
              Protein (g)
            </Label>
            <Input id="protein" name="protein" type="number" inputMode="numeric" defaultValue={data.protein ?? ""} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="carbs" className="text-xs">
              Carbs (g)
            </Label>
            <Input id="carbs" name="carbs" type="number" inputMode="numeric" defaultValue={data.carbs ?? ""} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="fat" className="text-xs">
              Fat (g)
            </Label>
            <Input id="fat" name="fat" type="number" inputMode="numeric" defaultValue={data.fat ?? ""} />
          </div>
        </div>
        <div className="flex justify-end">
          <SubmitButton label={logged ? "Update" : "Log"} />
        </div>
      </form>
    </DomainCard>
  )
}

// ---- recovery --------------------------------------------------------------

export function RecoveryEntry({ data }: { data: AthleteToday["recovery"] }) {
  const [state, action] = useActionState(logRecoveryAction, EMPTY)
  useEntryToast(state)

  return (
    <DomainCard
      title="Recovery"
      icon={Moon}
      done={data.logged}
      summary={data.sleepHours != null ? `${data.sleepHours} h sleep` : null}
    >
      <form action={action} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="sleep_hours" className="text-xs">
              Sleep (h)
            </Label>
            <Input id="sleep_hours" name="sleep_hours" type="number" step="0.5" inputMode="decimal" defaultValue={data.sleepHours ?? ""} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="soreness" className="text-xs">
              Soreness (1–10)
            </Label>
            <Input id="soreness" name="soreness" type="number" min={1} max={10} inputMode="numeric" defaultValue={data.soreness ?? ""} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="energy" className="text-xs">
              Energy (1–10)
            </Label>
            <Input id="energy" name="energy" type="number" min={1} max={10} inputMode="numeric" defaultValue={data.energy ?? ""} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="stress" className="text-xs">
              Stress (1–10)
            </Label>
            <Input id="stress" name="stress" type="number" min={1} max={10} inputMode="numeric" defaultValue={data.stress ?? ""} />
          </div>
        </div>
        <div className="flex justify-end">
          <SubmitButton label={data.logged ? "Update" : "Log"} />
        </div>
      </form>
    </DomainCard>
  )
}

// ---- supplements -----------------------------------------------------------

export function SupplementChecklist({
  supplements,
}: {
  supplements: AthleteToday["supplements"]
}) {
  const [items, setItems] = useState(supplements)
  const [, startTransition] = useTransition()

  useEffect(() => setItems(supplements), [supplements])

  const takenCount = items.filter((s) => s.taken).length

  function toggle(id: string, next: boolean) {
    setItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, taken: next } : s))
    )
    startTransition(async () => {
      const res = await toggleSupplementAction(id, next)
      if (!res.ok) {
        toast.error(res.error ?? "Save failed")
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, taken: !next } : s))
        )
      }
    })
  }

  return (
    <DomainCard
      title="Supplements"
      icon={Pill}
      done={items.length > 0 && takenCount === items.length}
      summary={items.length ? `${takenCount}/${items.length} taken` : "None"}
    >
      {items.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No supplements assigned right now.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.id}>
              <label className="flex items-center gap-3 py-1">
                <Checkbox
                  checked={s.taken}
                  onCheckedChange={(v) => toggle(s.id, v === true)}
                />
                <span className="flex-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      s.taken && "text-muted-foreground line-through"
                    )}
                  >
                    {s.name}
                  </span>
                  <span className="text-muted-foreground block text-[11px]">
                    {[s.dosage, s.timing].filter(Boolean).join(" · ") || "Daily"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </DomainCard>
  )
}
