// ============================================================================
// Supabase Database types — hand-authored to mirror supabase/migrations.
// Regenerate later with: supabase gen types typescript --linked > types/database.ts
// ============================================================================

export type Role = "coach" | "client" | "admin"
export type ClientStatus = "active" | "inactive" | "prospect" | "archived"
export type PlanDirection = "cut" | "maintain" | "bulk"
export type CompStatus = "planned" | "registered" | "completed" | "cancelled"
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled"
export type Priority = "low" | "medium" | "high" | "urgent"
export type AlertStatus = "active" | "acknowledged" | "resolved" | "snoozed"
export type Severity = "info" | "warning" | "critical"
export type Units = "imperial" | "metric"
export type CommChannel = "call" | "email" | "sms" | "in_person" | "other"
export type CommDirection = "inbound" | "outbound"
export type CombatDiscipline =
  | "mma"
  | "boxing"
  | "bjj"
  | "wrestling"
  | "judo"
  | "muay_thai"
  | "kickboxing"
  | "other"
export type WeightCutStatus =
  | "planning"
  | "active"
  | "peak_week"
  | "weigh_in"
  | "completed"
  | "cancelled"
export type WeighInKind = "check_in" | "official" | "unofficial"
export type ScheduleSessionType =
  | "training"
  | "consultation"
  | "check_in"
  | "competition_prep"
  | "follow_up"
  | "group_session"
export type SessionModality = "in_person" | "virtual" | "phone"
export type SessionStatus = "scheduled" | "completed" | "cancelled" | "no_show"

export type MessageSource = "gmail" | "sms" | "imessage" | "whatsapp" | "manual" | "csv" | "json"
export type MessageMatch = "phone" | "email" | "name" | "unmatched"
export type SuggestionDomain =
  | "diet"
  | "supplementation"
  | "altolab"
  | "low_base"
  | "hydration"
  | "recovery"
  | "labs"
  | "training"
export type SuggestionStatus = "pending" | "approved" | "edited" | "rejected"
export type PrescriptionStatus = "active" | "completed" | "cancelled"
export type CalendarCategory =
  | "strength"
  | "conditioning"
  | "sport"
  | "low_base"
  | "supplementation"
  | "altolab"
  | "nutrition"
  | "hydration"
  | "recovery"
  | "testing"
  | "labs"
  | "weigh_in"
  | "competition"
  | "check_in"
  | "note"
export type CalendarStatus = "planned" | "completed" | "skipped" | "missed"
export type CalendarRecurrence = "none" | "daily" | "weekly"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[]
type Timestamp = string

/** Columns whose type permits null — omittable on insert. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never
}[keyof T]

/**
 * Derive Insert / Update DTOs from a Row.
 * On insert, columns are optional when they carry a DB default (`Optional`)
 * or are nullable; everything else is required. Update is fully partial.
 */
type Table<Row, Optional extends keyof Row = never> = {
  Row: Row
  Insert: Omit<Row, Optional | NullableKeys<Row>> &
    Partial<Pick<Row, (Optional | NullableKeys<Row>) & keyof Row>>
  Update: Partial<Row>
  Relationships: []
}

// Columns that carry DB defaults (optional on insert).
type Defaults = "id" | "created_at"

export interface Database {
  public: {
    Tables: {
      profiles: Table<{
        id: string
        clerk_id: string
        role: Role
        full_name: string | null
        email: string | null
        avatar_url: string | null
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults | "role" | "updated_at">

      coach_settings: Table<{
        id: string
        coach_id: string
        business_name: string | null
        timezone: string
        units: Units
        alert_prefs: Json
        notification_prefs: Json
      }, "id" | "timezone" | "units" | "alert_prefs" | "notification_prefs">

      clients: Table<{
        id: string
        coach_id: string
        profile_id: string | null
        first_name: string
        last_name: string
        email: string | null
        phone: string | null
        date_of_birth: string | null
        gender: string | null
        sport: string | null
        discipline: string | null
        current_weight_class: string | null
        goal_summary: string | null
        status: ClientStatus
        start_date: string | null
        avatar_url: string | null
        emergency_contact: Json | null
        notes: string | null
        current_weight: number | null
        goal_weight: number | null
        next_competition: string | null
        competition_date: string | null
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults | "status" | "updated_at" | "profile_id">

      client_invites: Table<{
        id: string
        client_id: string
        token: string
        email: string | null
        expires_at: Timestamp
        accepted_at: Timestamp | null
        created_at: Timestamp
      }, Defaults>

      weight_goals: Table<{
        id: string
        client_id: string
        target_weight: number | null
        target_date: string | null
        direction: PlanDirection
        weekly_rate_lbs: number | null
        created_at: Timestamp
      }, Defaults | "direction">

      weight_logs: Table<{
        id: string
        client_id: string
        logged_by: string | null
        weight_lbs: number
        body_fat_pct: number | null
        muscle_mass_lbs: number | null
        body_fat_mass_lbs: number | null
        bmr: number | null
        total_body_water_lbs: number | null
        skeletal_muscle_mass_lbs: number | null
        logged_at: Timestamp
        photo_url: string | null
        notes: string | null
        created_at: Timestamp
      }, Defaults | "logged_at">

      nutrition_plans: Table<{
        id: string
        client_id: string
        coach_id: string
        name: string
        calories: number | null
        protein_g: number | null
        carbs_g: number | null
        fat_g: number | null
        fiber_g: number | null
        meal_structure: Json | null
        is_active: boolean
        effective_date: string | null
        notes: string | null
        created_at: Timestamp
      }, Defaults | "is_active">

      nutrition_logs: Table<{
        id: string
        client_id: string
        logged_by: string | null
        logged_date: string
        meal_label: string | null
        calories: number | null
        protein_g: number | null
        carbs_g: number | null
        fat_g: number | null
        fiber_g: number | null
        photo_url: string | null
        notes: string | null
        created_at: Timestamp
      }, Defaults>

      hydration_logs: Table<{
        id: string
        client_id: string
        logged_by: string | null
        logged_date: string
        oz_consumed: number
        oz_target: number | null
        notes: string | null
        created_at: Timestamp
      }, Defaults>

      supplements: Table<{
        id: string
        client_id: string
        coach_id: string
        name: string
        brand: string | null
        dosage: string | null
        frequency: string | null
        timing: string | null
        purpose: string | null
        is_active: boolean
        start_date: string | null
        end_date: string | null
        notes: string | null
        created_at: Timestamp
      }, Defaults | "is_active">

      supplement_logs: Table<{
        id: string
        client_id: string
        supplement_id: string
        logged_by: string | null
        logged_at: Timestamp
        taken: boolean
        notes: string | null
      }, "id" | "logged_at" | "taken">

      recovery_logs: Table<{
        id: string
        client_id: string
        logged_by: string | null
        logged_date: string
        sleep_hours: number | null
        sleep_quality: number | null
        soreness: number | null
        energy: number | null
        stress: number | null
        hrv: number | null
        resting_hr: number | null
        modalities: string[]
        notes: string | null
        created_at: Timestamp
      }, Defaults | "modalities">

      training_programs: Table<{
        id: string
        client_id: string
        coach_id: string
        name: string
        phase: string | null
        start_date: string | null
        end_date: string | null
        is_active: boolean
        notes: string | null
        created_at: Timestamp
      }, Defaults | "is_active">

      training_sessions: Table<{
        id: string
        client_id: string
        program_id: string | null
        scheduled_at: Timestamp | null
        completed_at: Timestamp | null
        session_type: string | null
        duration_min: number | null
        rpe: number | null
        notes: string | null
        created_at: Timestamp
      }, Defaults>

      exercises: Table<{
        id: string
        session_id: string
        name: string
        sets: number | null
        reps: string | null
        weight_lbs: number | null
        duration_sec: number | null
        distance_m: number | null
        notes: string | null
        order_index: number
      }, "id" | "order_index">

      competitions: Table<{
        id: string
        client_id: string
        coach_id: string
        name: string
        federation: string | null
        location: string | null
        competition_date: string
        weight_class: string | null
        divisions: string[]
        status: CompStatus
        result: string | null
        placement: number | null
        peak_weight: number | null
        weigh_in_weight: number | null
        notes: string | null
        created_at: Timestamp
      }, Defaults | "divisions" | "status">

      competition_tasks: Table<{
        id: string
        competition_id: string
        task: string
        due_date: string | null
        completed: boolean
        assigned_to: string | null
        created_at: Timestamp
      }, Defaults | "completed">

      message_threads: Table<{
        id: string
        coach_id: string
        client_id: string
        subject: string | null
        last_message_at: Timestamp | null
        created_at: Timestamp
      }, Defaults>

      messages: Table<{
        id: string
        thread_id: string
        sender_id: string
        body: string
        attachments: Json
        read_at: Timestamp | null
        created_at: Timestamp
      }, Defaults | "attachments">

      communications: Table<{
        id: string
        coach_id: string
        client_id: string
        channel: CommChannel
        direction: CommDirection
        summary: string
        occurred_at: Timestamp
        created_at: Timestamp
      }, Defaults | "occurred_at">

      tasks: Table<{
        id: string
        coach_id: string
        client_id: string | null
        title: string
        description: string | null
        status: TaskStatus
        priority: Priority
        due_date: string | null
        completed_at: Timestamp | null
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults | "status" | "priority" | "updated_at">

      alert_rules: Table<{
        id: string
        coach_id: string | null
        key: string
        description: string | null
        config: Json
        severity: Severity
        is_enabled: boolean
        created_at: Timestamp
      }, Defaults | "config" | "severity" | "is_enabled">

      alerts: Table<{
        id: string
        coach_id: string
        client_id: string
        rule_key: string
        severity: Severity
        status: AlertStatus
        title: string
        detail: string | null
        context: Json
        created_at: Timestamp
        acknowledged_at: Timestamp | null
        resolved_at: Timestamp | null
        snoozed_until: Timestamp | null
      }, Defaults | "severity" | "status" | "context">

      weight_classes: Table<{
        id: string
        coach_id: string | null
        discipline: CombatDiscipline
        federation: string | null
        name: string
        gender: string | null
        limit_lbs: number
        limit_kg: number | null
        sort_order: number
        created_at: Timestamp
      }, Defaults | "sort_order">

      weight_cuts: Table<{
        id: string
        client_id: string
        coach_id: string
        competition_id: string | null
        weight_class_id: string | null
        discipline: CombatDiscipline
        class_name: string | null
        class_limit_lbs: number
        walk_around_lbs: number | null
        camp_start_lbs: number | null
        target_weigh_in_lbs: number
        weigh_in_at: Timestamp | null
        competition_at: Timestamp | null
        rehydration_window_hours: number | null
        cut_method: string | null
        water_load_plan: Json
        hydration_restoration: Json
        refuel_protocol: Json
        status: WeightCutStatus
        made_weight: boolean | null
        notes: string | null
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults
        | "discipline"
        | "status"
        | "water_load_plan"
        | "hydration_restoration"
        | "refuel_protocol"
        | "updated_at">

      weigh_ins: Table<{
        id: string
        weight_cut_id: string
        client_id: string
        kind: WeighInKind
        scheduled_at: Timestamp
        target_lbs: number | null
        weight_lbs: number | null
        made_weight: boolean | null
        recorded_at: Timestamp | null
        notes: string | null
        created_at: Timestamp
      }, Defaults | "kind">

      schedule_sessions: Table<{
        id: string
        coach_id: string
        client_id: string | null
        title: string
        session_type: ScheduleSessionType
        scheduled_at: Timestamp
        duration_min: number
        location: string | null
        modality: SessionModality | null
        notes: string | null
        status: SessionStatus
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults | "session_type" | "duration_min" | "status" | "updated_at">

      biomarker_readings: Table<{
        id: string
        client_id: string
        logged_by: string | null
        marker: string
        label: string | null
        value_num: number | null
        value_text: string | null
        unit: string | null
        category: string | null
        measured_at: Timestamp
        source: string | null
        notes: string | null
        created_at: Timestamp
      }, Defaults | "measured_at">

      message_ingest: Table<{
        id: string
        coach_id: string
        client_id: string | null
        source: MessageSource
        external_id: string | null
        sender_name: string | null
        sender_phone: string | null
        sender_email: string | null
        body: string
        received_at: Timestamp | null
        match_method: MessageMatch
        match_confidence: number
        raw: Json | null
        created_at: Timestamp
      }, Defaults | "source" | "match_method" | "match_confidence">

      prescriptions: Table<{
        id: string
        coach_id: string
        client_id: string
        domain: SuggestionDomain
        title: string
        protocol: string
        details: Json | null
        source_suggestion_id: string | null
        status: PrescriptionStatus
        starts_on: string | null
        ends_on: string | null
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults | "status" | "updated_at">

      suggested_actions: Table<{
        id: string
        coach_id: string
        client_id: string | null
        message_id: string
        domain: SuggestionDomain
        intent: string | null
        suggested_protocol: string
        details: Json | null
        confidence: number
        sensitive: boolean
        status: SuggestionStatus
        reviewed_by: string | null
        reviewed_at: Timestamp | null
        prescription_id: string | null
        notes: string | null
        created_at: Timestamp
      }, Defaults | "confidence" | "sensitive" | "status">

      athlete_calendar_events: Table<{
        id: string
        coach_id: string
        client_id: string
        category: CalendarCategory
        title: string
        description: string | null
        starts_at: Timestamp
        ends_at: Timestamp | null
        all_day: boolean
        status: CalendarStatus
        recurrence: CalendarRecurrence
        recurrence_until: string | null
        prescription_id: string | null
        details: Json | null
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults | "all_day" | "status" | "recurrence" | "updated_at">
      athlete_calendar_event_overrides: Table<{
        id: string
        event_id: string
        occurrence_date: string
        status: CalendarStatus
        completed_at: Timestamp | null
        notes: string | null
        created_at: Timestamp
        updated_at: Timestamp
      }, Defaults | "status" | "updated_at">
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      role_t: Role
      client_status: ClientStatus
      plan_dir: PlanDirection
      comp_status: CompStatus
      task_status: TaskStatus
      priority_t: Priority
      alert_status: AlertStatus
      severity_t: Severity
      units_t: Units
      comm_channel: CommChannel
      comm_direction: CommDirection
      combat_discipline: CombatDiscipline
      weight_cut_status: WeightCutStatus
      weigh_in_kind: WeighInKind
      schedule_session_type: ScheduleSessionType
      session_modality: SessionModality
      session_status: SessionStatus
      message_source: MessageSource
      message_match: MessageMatch
      suggestion_domain: SuggestionDomain
      suggestion_status: SuggestionStatus
      prescription_status: PrescriptionStatus
      calendar_category: CalendarCategory
      calendar_status: CalendarStatus
      calendar_recurrence: CalendarRecurrence
    }
  }
}

// Convenience row aliases.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type InsertDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type UpdateDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
