import { ListTodo } from "lucide-react"

import { Card, SectionHeader, EmptyState } from "@/components/ds"

// Notes (U3) — placeholder section in the athlete-first IA. No notes backend
// exists yet, so this is an honest empty state (no fake data). The section slot is
// here so the feature can land later without an IA change.
export default function ClientNotesPage() {
  return (
    <Card>
      <SectionHeader title="Notes" />
      <EmptyState
        icon={<ListTodo />}
        title="No notes yet"
        description="Coaching notes for this athlete will live here."
      />
    </Card>
  )
}
