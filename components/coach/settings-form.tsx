"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { saveSettingsAction } from "@/lib/actions/settings"
import type { ActionState } from "@/lib/actions/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CoachSettingsData } from "@/types/models"

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  suffix,
}: {
  label: string
  name: string
  defaultValue?: string | number
  type?: string
  step?: string
  suffix?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} />
        {suffix ? <span className="text-muted-foreground text-sm">{suffix}</span> : null}
      </div>
    </div>
  )
}

function Toggle({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string
  name: string
  defaultChecked?: boolean
  hint?: string
}) {
  return (
    <label className="flex items-start gap-3 py-1.5">
      <Checkbox id={name} name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-muted-foreground block text-xs">{hint}</span> : null}
      </span>
    </label>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  )
}

export function SettingsForm({ settings }: { settings: CoachSettingsData }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveSettingsAction,
    { ok: false }
  )

  useEffect(() => {
    if (state.ok) toast.success("Settings saved")
    else if (state.error) toast.error(state.error)
  }, [state])

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coach profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="coach_name" defaultValue={settings.coach.fullName} />
          <Field label="Email" name="coach_email" type="email" defaultValue={settings.coach.email} />
          <Field label="Phone" name="coach_phone" defaultValue={settings.coach.phone} />
          <div className="grid gap-2">
            <Label htmlFor="coach_tz">Timezone</Label>
            <select
              id="coach_tz"
              name="coach_tz"
              defaultValue={settings.coach.timezone}
              className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs"
            >
              {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" name="biz_name" defaultValue={settings.business.name} />
          <Field label="Location" name="biz_location" defaultValue={settings.business.location} />
          <Field label="Website" name="biz_website" defaultValue={settings.business.website} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle label="Email alerts" name="notif_email" defaultChecked={settings.notifications.emailAlerts} hint="Critical & warning alerts by email" />
          <Toggle label="SMS alerts" name="notif_sms" defaultChecked={settings.notifications.smsAlerts} hint="Urgent alerts by text" />
          <Toggle label="Weekly digest" name="notif_digest" defaultChecked={settings.notifications.weeklyDigest} hint="Sunday roster summary" />
          <Toggle label="Daily agenda email" name="notif_agenda" defaultChecked={settings.notifications.dailyAgenda} hint="Morning agenda roll-up" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default nutrition targets</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Calories" name="nut_cal" type="number" defaultValue={settings.nutritionDefaults.calories} suffix="kcal" />
            <Field label="Protein" name="nut_pro" type="number" defaultValue={settings.nutritionDefaults.protein} suffix="g" />
            <Field label="Carbs" name="nut_carb" type="number" defaultValue={settings.nutritionDefaults.carbs} suffix="g" />
            <Field label="Fat" name="nut_fat" type="number" defaultValue={settings.nutritionDefaults.fat} suffix="g" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default hydration target</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Daily water target" name="hyd_oz" type="number" defaultValue={settings.hydrationDefaults.ozTarget} suffix="oz" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default supplement protocol</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.supplementDefaults.map((s, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-3">
              <Input name={`sup_name_${i}`} defaultValue={s.name} aria-label="Supplement name" />
              <Input name={`sup_dose_${i}`} defaultValue={s.dosage} aria-label="Dosage" />
              <Input name={`sup_time_${i}`} defaultValue={s.timing} aria-label="Timing" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alert thresholds</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Missed weigh-in" name="al_weighin" type="number" defaultValue={settings.alertThresholds.missedWeighInDays} suffix="days" />
            <Field label="Low hydration" name="al_hyd" type="number" defaultValue={settings.alertThresholds.lowHydrationPct} suffix="% target" />
            <Field label="Poor sleep" name="al_sleep" type="number" step="0.5" defaultValue={settings.alertThresholds.poorSleepHours} suffix="hours" />
            <Field label="High soreness" name="al_sore" type="number" defaultValue={settings.alertThresholds.highSoreness} suffix="/10" />
            <Field label="Low protein" name="al_protein" type="number" defaultValue={settings.alertThresholds.lowProteinPct} suffix="% target" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competition weight-cut settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Max safe cut" name="cut_pct" type="number" step="0.1" defaultValue={settings.weightCutDefaults.maxPctPerDay} suffix="%BW/day" />
            <Field label="Rehydration window" name="cut_window" type="number" defaultValue={settings.weightCutDefaults.rehydrationWindowHours} suffix="hours" />
            <Field label="Water-load length" name="cut_load" type="number" defaultValue={settings.weightCutDefaults.waterLoadDays} suffix="days" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dev mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auth bypass</p>
              <p className="text-muted-foreground text-xs">
                Serves mock data with no Clerk / Supabase. Controlled by{" "}
                <code className="text-xs">NEXT_PUBLIC_DEV_AUTH_BYPASS</code>.
              </p>
            </div>
            <Badge
              variant="secondary"
              className={
                settings.devMode.authBypass
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              }
            >
              {settings.devMode.authBypass ? "ON" : "OFF"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <SaveButton />
      </div>
    </form>
  )
}
