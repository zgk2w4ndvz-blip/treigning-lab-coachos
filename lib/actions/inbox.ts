"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getCreatedSuggestions, setSuggestionOverride } from "@/lib/dev-inbox-store"
import { addCreatedTask } from "@/lib/dev-tasks-store"
import { addStoredPrescription } from "@/lib/dev-prescription-store"
import { mockReviewQueue } from "@/lib/mock/inbox"
import { runIngest } from "@/lib/messages/ingest"
import { bodyCompToWeightLogFields } from "@/lib/messages/body-comp"
import { parseMessages, type MessageFormat } from "@/lib/messages/parse"
import { fetchGmailMessages } from "@/lib/messages/sources/gmail"
import type { ActionState } from "@/lib/actions/types"
import type { SuggestionDomain } from "@/types/database"
import type { TaskType } from "@/types/models"

const AFFECTED_REVIEW = ["/inbox", "/tasks", "/agenda", "/dashboard"]
function revalidateReview() {
  for (const p of AFFECTED_REVIEW) revalidatePath(p)
}

/** Map a suggestion domain to the closest existing coach-task type. */
const DOMAIN_TASK_TYPE: Record<SuggestionDomain, TaskType> = {
  diet: "nutrition",
  supplementation: "supplements",
  altolab: "training",
  low_base: "training",
  hydration: "hydration",
  recovery: "recovery",
  labs: "general",
  training: "training",
  body_composition: "general",
}

export interface IngestResult extends ActionState {
  messageCount?: number
  suggestionCount?: number
  matched?: number
  rowErrors?: string[]
}

const AFFECTED = ["/inbox", "/dashboard"]
function revalidate() {
  for (const p of AFFECTED) revalidatePath(p)
}

/** Manual import: parse CSV/JSON → match → classify → pending suggestions. */
export async function ingestMessagesAction(
  text: string,
  formatHint?: MessageFormat
): Promise<IngestResult> {
  const { messages, errors } = parseMessages(text ?? "", formatHint)
  if (messages.length === 0) {
    return { ok: false, error: errors[0] ?? "No messages found.", rowErrors: errors }
  }
  try {
    const r = await runIngest(messages, errors)
    revalidate()
    return { ok: true, messageCount: r.messageCount, suggestionCount: r.suggestionCount, matched: r.matched, rowErrors: r.errors }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ingest failed." }
  }
}

/** Gmail source: fetch recent emails → same ingest pipeline. */
export async function ingestFromGmailAction(opts?: {
  query?: string
  maxResults?: number
}): Promise<IngestResult> {
  let messages
  try {
    messages = await fetchGmailMessages(opts)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gmail fetch failed." }
  }
  if (messages.length === 0) {
    return { ok: true, messageCount: 0, suggestionCount: 0, matched: 0, error: "No new Gmail messages matched the query." }
  }
  try {
    const r = await runIngest(messages)
    revalidate()
    return { ok: true, messageCount: r.messageCount, suggestionCount: r.suggestionCount, matched: r.matched, rowErrors: r.errors }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ingest failed." }
  }
}

/** Approve (optionally edited) or reject a suggestion. Approval → prescription. */
export async function reviewSuggestionAction(
  id: string,
  decision: "approve" | "reject",
  editedProtocol?: string
): Promise<ActionState> {
  const now = new Date().toISOString()
  const edited = editedProtocol != null && editedProtocol.trim().length > 0

  try {
    if (DEV_AUTH_BYPASS) {
      setSuggestionOverride(id, {
        status: decision === "reject" ? "rejected" : edited ? "edited" : "approved",
        reviewedAt: now,
        editedProtocol: edited ? editedProtocol!.trim() : undefined,
      })
      // Approval mints a coach task (alongside the prescription) on the existing
      // tasks board + agenda. Look up the suggestion for its athlete + domain.
      if (decision === "approve") {
        const item = [...getCreatedSuggestions(), ...mockReviewQueue()].find((s) => s.id === id)
        if (item?.clientId) {
          const protocol = edited ? editedProtocol!.trim() : item.suggestedProtocol
          addCreatedTask({
            id: randomUUID(),
            clientId: item.clientId,
            clientName: item.athleteName,
            title: protocol,
            description: `From ${item.source} message: “${item.messageSnippet.slice(0, 140)}”`,
            type: DOMAIN_TASK_TYPE[item.domain],
            status: "open",
            priority: item.sensitive ? "high" : "medium",
            dueDate: null,
            completedAt: null,
            createdAt: now,
          })
          addStoredPrescription(item.clientId, {
            id: randomUUID(),
            domain: item.domain,
            title: item.intent ?? item.domain,
            protocol,
            status: "active",
            createdAt: now,
          })
        }
      }
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      if (decision === "reject") {
        const { error } = await supabase
          .from("suggested_actions")
          .update({ status: "rejected", reviewed_by: coach.id, reviewed_at: now })
          .eq("id", id)
        if (error) return { ok: false, error: error.message }
      } else {
        const { data: s, error: sErr } = await supabase
          .from("suggested_actions").select("*").eq("id", id).single()
        if (sErr || !s) return { ok: false, error: sErr?.message ?? "Suggestion not found." }
        if (!s.client_id) return { ok: false, error: "Match this message to an athlete before approving." }

        const details = s.details as unknown as
          | {
              action?: string
              context?: string
              entries?: { label?: string; weightLbs?: number }[]
              body_fat_percentage?: number
              skeletal_muscle_mass_lbs?: number
              body_fat_mass_lbs?: number
              total_body_water_lbs?: number
              bmr?: number
              weight_lbs?: number
              calories?: number
              protein_g?: number
              carbs_g?: number
              fat_g?: number
              minutes_per_session?: number
              frequency_per_week?: number
              vo2_max?: number
              mep_bpm?: number
              aerobic_threshold_bpm?: number
              max_hr_bpm?: number
            }
          | null

        if (details?.action === "create_weight_log" && Array.isArray(details.entries)) {
          // Structured weight report → write weight_logs (NOT a prescription).
          const isComp = details.context === "competition"
          const { data: msg } = await supabase
            .from("message_ingest").select("received_at, source").eq("id", s.message_id).single()
          const baseDate = msg?.received_at ? new Date(msg.received_at) : new Date()
          const rows = details.entries
            .filter((e) => typeof e.weightLbs === "number")
            .map((e) => {
              const at = new Date(baseDate)
              at.setHours(e.label === "morning" ? 7 : e.label === "evening" ? 19 : 12, 0, 0, 0)
              const tags = [isComp ? "competition" : null, e.label && e.label !== "general" ? e.label : null]
                .filter(Boolean).join(", ")
              return {
                client_id: s.client_id!, logged_by: coach.id, weight_lbs: e.weightLbs!,
                logged_at: at.toISOString(),
                notes: `From ${msg?.source ?? "message"}${tags ? ` (${tags})` : ""}`,
              }
            })
          if (rows.length === 0) return { ok: false, error: "No valid weight values to log." }
          const { error: wErr } = await supabase.from("weight_logs").insert(rows)
          if (wErr) return { ok: false, error: wErr.message }
          const { error: uErr } = await supabase
            .from("suggested_actions")
            .update({ status: edited ? "edited" : "approved", reviewed_by: coach.id, reviewed_at: now })
            .eq("id", id)
          if (uErr) return { ok: false, error: uErr.message }
        } else if (details?.action === "body_composition_update") {
          // Structured body-composition reading → create/update a weight_log's
          // body-comp fields (NOT a prescription). Weight is only set if the
          // payload carries one; otherwise the existing/last-known weight stays.
          const { data: msg } = await supabase
            .from("message_ingest").select("received_at, source").eq("id", s.message_id).single()
          const at = msg?.received_at ? new Date(msg.received_at) : new Date()
          const dateStr = at.toISOString().slice(0, 10)

          const fields = bodyCompToWeightLogFields(details)

          // Same-day weight_log → update it; else create a new measurement.
          const { data: existRows } = await supabase
            .from("weight_logs")
            .select("id, weight_lbs")
            .eq("client_id", s.client_id)
            .gte("logged_at", `${dateStr}T00:00:00`)
            .lte("logged_at", `${dateStr}T23:59:59.999`)
            .order("logged_at", { ascending: false })
            .limit(1)
          const existing = existRows?.[0]

          if (existing) {
            const { error } = await supabase.from("weight_logs").update(fields).eq("id", existing.id)
            if (error) return { ok: false, error: error.message }
          } else {
            let weight: number | null = fields.weight_lbs ?? null
            if (weight == null) {
              const { data: last } = await supabase
                .from("weight_logs").select("weight_lbs")
                .eq("client_id", s.client_id).order("logged_at", { ascending: false }).limit(1)
              weight = last?.[0]?.weight_lbs ?? null
            }
            if (weight == null) {
              const { data: client } = await supabase
                .from("clients").select("current_weight").eq("id", s.client_id).maybeSingle()
              weight = client?.current_weight ?? null
            }
            if (weight == null) {
              return { ok: false, error: "No weight on record — log a weight for this athlete first." }
            }
            const { error } = await supabase.from("weight_logs").insert({
              ...fields,
              client_id: s.client_id, logged_by: coach.id, weight_lbs: weight,
              logged_at: at.toISOString(),
              notes: `From ${msg?.source ?? "message"} (body composition)`,
            })
            if (error) return { ok: false, error: error.message }
          }

          const { error: uErr } = await supabase
            .from("suggested_actions")
            .update({ status: edited ? "edited" : "approved", reviewed_by: coach.id, reviewed_at: now })
            .eq("id", id)
          if (uErr) return { ok: false, error: uErr.message }
        } else if (details?.action === "nutrition_prescription") {
          // Coach nutrition prescription → upsert the athlete's active plan.
          const macros: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } = {}
          if (details.calories != null) macros.calories = details.calories
          if (details.protein_g != null) macros.protein_g = details.protein_g
          if (details.carbs_g != null) macros.carbs_g = details.carbs_g
          if (details.fat_g != null) macros.fat_g = details.fat_g

          const { data: planRows } = await supabase
            .from("nutrition_plans").select("id")
            .eq("client_id", s.client_id).eq("is_active", true)
            .order("created_at", { ascending: false }).limit(1)
          const plan = planRows?.[0]
          if (plan) {
            const { error } = await supabase.from("nutrition_plans").update(macros).eq("id", plan.id)
            if (error) return { ok: false, error: error.message }
          } else {
            const { error } = await supabase.from("nutrition_plans").insert({
              client_id: s.client_id, coach_id: coach.id,
              name: "iMessage prescription", is_active: true, ...macros,
            })
            if (error) return { ok: false, error: error.message }
          }
          const { error: uErr } = await supabase
            .from("suggested_actions")
            .update({ status: edited ? "edited" : "approved", reviewed_by: coach.id, reviewed_at: now })
            .eq("id", id)
          if (uErr) return { ok: false, error: uErr.message }
        } else if (details?.action === "metabolic_assessment") {
          // Coach metabolic biometrics → log a metabolic_assessments row. The
          // assessment is timestamped from the source message when available.
          const fields: {
            vo2_max?: number
            mep_bpm?: number
            aerobic_threshold_bpm?: number
            max_hr_bpm?: number
          } = {}
          if (details.vo2_max != null) fields.vo2_max = details.vo2_max
          if (details.mep_bpm != null) fields.mep_bpm = details.mep_bpm
          if (details.aerobic_threshold_bpm != null) fields.aerobic_threshold_bpm = details.aerobic_threshold_bpm
          if (details.max_hr_bpm != null) fields.max_hr_bpm = details.max_hr_bpm
          if (Object.keys(fields).length === 0) {
            return { ok: false, error: "No metabolic values to log." }
          }
          const { data: msg } = await supabase
            .from("message_ingest").select("received_at").eq("id", s.message_id).single()
          const { error } = await supabase.from("metabolic_assessments").insert({
            client_id: s.client_id,
            logged_by: coach.id,
            source: "imessage",
            assessed_at: msg?.received_at ?? now,
            ...fields,
          })
          if (error) return { ok: false, error: error.message }
          const { error: uErr } = await supabase
            .from("suggested_actions")
            .update({ status: edited ? "edited" : "approved", reviewed_by: coach.id, reviewed_at: now })
            .eq("id", id)
          if (uErr) return { ok: false, error: uErr.message }
        } else if (details?.action === "low_base_prescription") {
          // Coach Low Base prescription → upsert the athlete's low_base record
          // (dose only; MEP stays as-is, or null on a fresh record).
          const dose: { minutes_per_session?: number; frequency_per_week?: number } = {}
          if (details.minutes_per_session != null) dose.minutes_per_session = details.minutes_per_session
          if (details.frequency_per_week != null) dose.frequency_per_week = details.frequency_per_week

          const { data: lbRows } = await supabase
            .from("low_base_prescriptions").select("id").eq("client_id", s.client_id).limit(1)
          const lb = lbRows?.[0]
          if (lb) {
            const { error } = await supabase
              .from("low_base_prescriptions")
              .update({ ...dose, updated_at: new Date().toISOString() })
              .eq("id", lb.id)
            if (error) return { ok: false, error: error.message }
          } else {
            const { error } = await supabase.from("low_base_prescriptions").insert({
              client_id: s.client_id, coach_id: coach.id, mep_bpm: null,
              minutes_per_session: dose.minutes_per_session ?? 30,
              frequency_per_week: dose.frequency_per_week ?? 3,
            })
            if (error) return { ok: false, error: error.message }
          }
          const { error: uErr } = await supabase
            .from("suggested_actions")
            .update({ status: edited ? "edited" : "approved", reviewed_by: coach.id, reviewed_at: now })
            .eq("id", id)
          if (uErr) return { ok: false, error: uErr.message }
        } else {
          const protocol = edited ? editedProtocol!.trim() : s.suggested_protocol
          const { data: presc, error: pErr } = await supabase
            .from("prescriptions")
            .insert({
              coach_id: coach.id, client_id: s.client_id, domain: s.domain,
              title: s.intent ?? s.domain, protocol, source_suggestion_id: s.id, status: "active",
            })
            .select("id").single()
          if (pErr || !presc) return { ok: false, error: pErr?.message ?? "Could not create prescription." }
          const { error: uErr } = await supabase
            .from("suggested_actions")
            .update({
              status: edited ? "edited" : "approved", reviewed_by: coach.id,
              reviewed_at: now, prescription_id: presc.id, suggested_protocol: protocol,
            })
            .eq("id", id)
          if (uErr) return { ok: false, error: uErr.message }

          // Mint a coach task so the approval shows on /tasks + the agenda.
          await supabase.from("tasks").insert({
            coach_id: coach.id, client_id: s.client_id, title: protocol,
            description: `Approved from a ${s.domain} message suggestion.`,
            priority: s.sensitive ? "high" : "medium", status: "open",
          })
        }
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Review failed." }
  }

  revalidateReview()
  return { ok: true }
}
