import Link from "next/link"
import { Upload, ChevronRight } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getCoachSettings } from "@/lib/data/settings"
import { hasImportedRoster } from "@/lib/dev-roster-store"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SettingsForm } from "@/components/coach/settings-form"

export default async function SettingsPage() {
  await requireCoach()
  const settings = await getCoachSettings()
  const imported = hasImportedRoster()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Settings"
        description="Coach profile, business, notifications, default targets, alert thresholds, and weight-cut defaults."
      />

      <Link href="/settings/import" className="block">
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="bg-primary/10 text-primary rounded-md p-2.5">
              <Upload className="size-5" />
            </div>
            <div className="flex-1">
              <p className="flex items-center gap-2 font-medium">
                Import Roster
                {imported ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Your roster active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Demo data</Badge>
                )}
              </p>
              <p className="text-muted-foreground text-sm">
                Upload or paste a CSV to replace the demo athletes with your real roster.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground size-5" />
          </CardContent>
        </Card>
      </Link>

      <SettingsForm settings={settings} />
    </main>
  )
}
