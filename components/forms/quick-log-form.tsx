"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import type { ActionState } from "@/lib/actions/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface LogField {
  name: string
  label: string
  type: "number" | "text" | "date" | "datetime-local" | "select" | "checkbox"
  step?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  defaultValue?: string
  required?: boolean
  full?: boolean
}

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  )
}

export function QuickLogForm({
  title,
  fields,
  action,
  submitLabel = "Save",
}: {
  title: string
  fields: LogField[]
  action: FormAction
  submitLabel?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {
    ok: false,
  })
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) {
      toast.success("Logged")
      ref.current?.reset()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={ref} action={formAction} className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.name}
              className={`grid gap-2 ${f.full ? "sm:col-span-2" : ""} ${
                f.type === "checkbox" ? "flex-row items-center" : ""
              }`}
            >
              <Label htmlFor={f.name}>{f.label}</Label>
              {f.type === "select" ? (
                <select
                  id={f.name}
                  name={f.name}
                  defaultValue={f.defaultValue}
                  className="border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-3 text-sm shadow-xs"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <input
                  id={f.name}
                  name={f.name}
                  type="checkbox"
                  className="size-4"
                  defaultChecked={f.defaultValue === "on"}
                />
              ) : (
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.type}
                  step={f.step}
                  placeholder={f.placeholder}
                  defaultValue={f.defaultValue}
                  required={f.required}
                />
              )}
              {state.fieldErrors?.[f.name]?.length ? (
                <p className="text-destructive text-xs">
                  {state.fieldErrors[f.name][0]}
                </p>
              ) : null}
            </div>
          ))}
          <div className="sm:col-span-2">
            <SubmitButton label={submitLabel} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
