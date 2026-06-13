import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { saveClientAction } from "@/lib/actions/clients"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { RosterClientForm } from "@/components/forms/roster-client-form"

export default async function NewClientPage() {
  await requireCoach()
  const action = saveClientAction.bind(null, null)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/clients/manage">
            <ArrowLeft className="size-4" />
            Back to roster
          </Link>
        </Button>
        <PageHeader title="Add client" description="Add an athlete to your roster." />
      </div>
      <RosterClientForm action={action} submitLabel="Add client" />
    </main>
  )
}
