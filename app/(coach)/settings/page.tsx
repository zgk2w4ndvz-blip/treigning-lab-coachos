import Link from "next/link"
import { Upload, ChevronRight } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getCoachSettings } from "@/lib/data/settings"
import { hasImportedRoster } from "@/lib/dev-roster-store"
import { SettingsForm } from "@/components/coach/settings-form"
import { ConnectorsPanel } from "@/components/coach/connectors-panel"
import { NotificationPrefs } from "@/components/coach/notification-prefs"
import { Card, ListRow, Badge } from "@/components/ds"

// Settings (U4) — modernized shell on ds primitives + Connectors and Notification
// Preferences panels. Reuses getCoachSettings; the existing SettingsForm is kept.
// No backend changes; the prefs panel is a display-only preview.
export default async function SettingsPage() {
  await requireCoach()
  const settings = await getCoachSettings()
  const imported = hasImportedRoster()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="font-sans text-[22px] font-medium tracking-normal text-ds-text-primary">
          Settings
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Coach profile, connectors, notifications, default targets, and alert thresholds.
        </p>
      </div>

      <Link href="/settings/import" className="block">
        <Card interactive>
          <ListRow
            leading={
              <span className="flex size-9 items-center justify-center rounded-control bg-ds-primary-bg text-ds-primary-on">
                <Upload className="size-4" />
              </span>
            }
            title="Import roster"
            subtitle="Upload or paste a CSV to replace the demo athletes with your real roster."
            trailing={
              <span className="flex items-center gap-2">
                <Badge tone={imported ? "positive" : "neutral"}>
                  {imported ? "Your roster active" : "Demo data"}
                </Badge>
                <ChevronRight className="size-5 text-ds-text-muted" />
              </span>
            }
          />
        </Card>
      </Link>

      <ConnectorsPanel />

      <NotificationPrefs />

      <SettingsForm settings={settings} />
    </main>
  )
}
