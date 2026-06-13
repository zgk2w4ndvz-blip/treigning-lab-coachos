import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getClientById } from "@/lib/data/clients"
import { listWeightClasses } from "@/lib/data/combat"
import { createWeightCutAction } from "@/lib/actions/combat"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { mockCompetitions } from "@/lib/mock/athletes"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { WeightCutForm } from "@/components/forms/weight-cut-form"

export default async function NewCutPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params

  const client = await getClientById(clientId)
  if (!client) notFound()

  const weightClasses = await listWeightClasses()
  const competitions = DEV_AUTH_BYPASS
    ? mockCompetitions.filter((c) => c.client_id === clientId)
    : ((
        await (await createServerSupabase())
          .from("competitions")
          .select("*")
          .eq("client_id", clientId)
          .gte("competition_date", new Date().toISOString().slice(0, 10))
          .order("competition_date", { ascending: true })
      ).data ?? [])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/clients/${clientId}/combat`}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <PageHeader
          title="Plan a weight cut"
          description={`${client.first_name} ${client.last_name}`}
        />
      </div>
      <WeightCutForm
        action={createWeightCutAction}
        clientId={clientId}
        weightClasses={weightClasses}
        competitions={competitions}
        submitLabel="Create cut"
      />
    </div>
  )
}
