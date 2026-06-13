import { requireClient } from "@/lib/auth"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { AthleteHeader } from "@/components/athlete/athlete-header"
import { AthleteBottomNav } from "@/components/athlete/athlete-bottom-nav"

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Gate: only athletes (clients) reach this shell.
  const profile = await requireClient()

  return (
    <div className="bg-muted/30 mx-auto flex min-h-screen w-full max-w-md flex-col">
      <AthleteHeader
        name={profile.full_name ?? "Athlete"}
        devMode={DEV_AUTH_BYPASS}
      />
      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
      <AthleteBottomNav />
    </div>
  )
}
