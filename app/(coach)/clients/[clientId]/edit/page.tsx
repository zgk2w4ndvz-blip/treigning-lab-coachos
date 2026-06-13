import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getRosterClient } from "@/lib/data/client-repo"
import { saveClientAction } from "@/lib/actions/clients"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { RosterClientForm } from "@/components/forms/roster-client-form"

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const client = await getRosterClient(clientId)
  if (!client) notFound()

  const action = saveClientAction.bind(null, clientId)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/clients/${clientId}`}>
            <ArrowLeft className="size-4" />
            Back to athlete
          </Link>
        </Button>
        <PageHeader
          title={`Edit ${client.firstName} ${client.lastName}`}
          description="Update this athlete's roster record."
        />
      </div>
      <RosterClientForm
        action={action}
        defaultValues={client}
        submitLabel="Save changes"
      />
    </main>
  )
}
