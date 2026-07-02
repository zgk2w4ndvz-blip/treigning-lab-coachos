import { requireCoach } from "@/lib/auth"
import { getActiveAlertCount } from "@/lib/data/dashboard"
import { getInboxPendingCount } from "@/lib/data/inbox"
import { listClientsForRoster } from "@/lib/data/clients"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { CoachSidebar } from "@/components/coach/coach-sidebar"
import { CoachTopbar } from "@/components/coach/coach-topbar"
import { CommandPalette } from "@/components/coach/command-palette"

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Gate: only coaches/admins reach this shell.
  await requireCoach()

  const [alertCount, inboxCount, roster] = await Promise.all([
    getActiveAlertCount(),
    getInboxPendingCount(),
    listClientsForRoster(),
  ])

  // Light projection for the global ⌘K palette (id + name only).
  const paletteRoster = roster.map((c) => ({
    id: c.client.id,
    name: `${c.client.first_name} ${c.client.last_name}`,
  }))

  return (
    <div className="flex min-h-screen w-full">
      <CoachSidebar inboxCount={inboxCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CoachTopbar alertCount={alertCount} devMode={DEV_AUTH_BYPASS} />
        <div className="flex-1">{children}</div>
      </div>
      <CommandPalette roster={paletteRoster} />
    </div>
  )
}
