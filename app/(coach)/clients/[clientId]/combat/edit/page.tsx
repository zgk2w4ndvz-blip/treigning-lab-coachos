import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getClientById } from "@/lib/data/clients"
import { getClientCombatDetail, listWeightClasses } from "@/lib/data/combat"
import { updateWeightCutAction } from "@/lib/actions/combat"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { mockCompetitions } from "@/lib/mock/athletes"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { WeightCutForm } from "@/components/forms/weight-cut-form"

export default async function EditCutPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params

  const [client, detail] = await Promise.all([
    getClientById(clientId),
    getClientCombatDetail(clientId),
  ])
  if (!client) notFound()
  if (!detail) notFound()

  const weightClasses = await listWeightClasses()
  const competitions = DEV_AUTH_BYPASS
    ? mockCompetitions.filter((c) => c.client_id === clientId)
    : ((
        await (await createServerSupabase())
          .from("competitions")
          .select("*")
          .eq("client_id", clientId)
          .order("competition_date", { ascending: true })
      ).data ?? [])

  const action = updateWeightCutAction.bind(null, detail.cut.id, clientId)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/clients/${clientId}/combat`}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <PageHeader title="Edit weight cut" description={`${client.first_name} ${client.last_name}`} />
      </div>
      <WeightCutForm
        action={action}
        clientId={clientId}
        weightClasses={weightClasses}
        competitions={competitions}
        defaultValues={detail.cut}
        submitLabel="Save changes"
      />
    </div>
  )
}
