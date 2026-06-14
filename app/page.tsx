import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getCurrentProfile } from "@/lib/auth"

export default async function LandingPage() {
  const profile = await getCurrentProfile()
  if (profile) {
    redirect(profile.role === "client" ? "/today" : "/dashboard")
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
          Treigning Lab
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          CoachOS
        </h1>
        <p className="text-muted-foreground mx-auto max-w-xl text-lg">
          The coaching command center for athlete performance, nutrition,
          recovery, and competition prep — all in one place.
        </p>
      </div>

      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="https://accounts.treigninglaboklahoma.com/sign-up">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="https://accounts.treigninglaboklahoma.com/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  )
}
