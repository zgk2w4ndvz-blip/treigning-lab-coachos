// ============================================================================
// App-facing domain models. These mirror the DB rows (types/database.ts) but
// are re-exported with friendlier names + aggregate shapes used by the UI.
// ============================================================================

import type {
  Tables,
  Priority,
  TaskStatus,
  ScheduleSessionType,
  SessionModality,
  SessionStatus,
  SuggestionDomain,
  SuggestionStatus,
  MessageMatch,
  MessageSource,
  CalendarStatus,
} from "@/types/database"

export type {
  SuggestionDomain,
  SuggestionStatus,
  MessageMatch,
  MessageSource,
  CalendarCategory,
  CalendarStatus,
  CalendarRecurrence,
} from "@/types/database"

export type {
  MetabolicSource,
  MetabolicCurvePhase,
  Role,
  ClientStatus,
  PlanDirection,
  CompStatus,
  TaskStatus,
  Priority,
  AlertStatus,
  Severity,
  Units,
  CommChannel,
  CommDirection,
  CombatDiscipline,
  WeightCutStatus,
  WeighInKind,
  ScheduleSessionType,
  SessionModality,
  SessionStatus,
} from "@/types/database"

export type Profile = Tables<"profiles">
export type CoachSettings = Tables<"coach_settings">
export type Client = Tables<"clients">
export type ClientInvite = Tables<"client_invites">
export type WeightGoal = Tables<"weight_goals">
export type WeightLog = Tables<"weight_logs">
export type BodyMeasurement = Tables<"body_measurements">
export type MetabolicAssessment = Tables<"metabolic_assessments">
export type MetabolicCurvePoint = Tables<"metabolic_curve_points">
export type NutritionPlan = Tables<"nutrition_plans">
export type NutritionLog = Tables<"nutrition_logs">
export type HydrationLog = Tables<"hydration_logs">
export type Supplement = Tables<"supplements">
export type SupplementLog = Tables<"supplement_logs">
export type RecoveryLog = Tables<"recovery_logs">
export type TrainingProgram = Tables<"training_programs">
export type TrainingSession = Tables<"training_sessions">
export type Exercise = Tables<"exercises">
export type Competition = Tables<"competitions">
export type CompetitionTask = Tables<"competition_tasks">
export type MessageThread = Tables<"message_threads">
export type Message = Tables<"messages">
export type Communication = Tables<"communications">
export type Task = Tables<"tasks">
export type AlertRule = Tables<"alert_rules">
export type Alert = Tables<"alerts">
export type WeightClass = Tables<"weight_classes">
export type WeighIn = Tables<"weigh_ins">
export type BiomarkerReading = Tables<"biomarker_readings">
export type MessageIngest = Tables<"message_ingest">
export type SuggestedAction = Tables<"suggested_actions">
export type Prescription = Tables<"prescriptions">
export type LowBasePrescription = Tables<"low_base_prescriptions">
export type WeightPlan = Tables<"weight_plans">
export type WeightPlanTarget = Tables<"weight_plan_targets">

// ---- Weight Planning (Phase 1B) -------------------------------------------

/** Derived (computed, not stored) weight-plan summary metrics. */
export interface WeightPlanSummary {
  poundsRemaining: number | null
  weeksRemaining: number | null
  totalWeeks: number | null
  poundsPerWeek: number | null
  dailyCalorieDeficit: number | null
  /** Direction inferred from current vs goal. */
  direction: "cut" | "gain" | "maintain"
  /** True when the planned rate exceeds a safe weekly threshold. */
  aggressive: boolean
}

/** Nutrition targets derived from the plan + integrations. */
export interface WeightPlanNutrition {
  maintenanceCalories: number | null
  dailyCalorieTarget: number | null
  proteinTargetG: number | null
  potassiumTargetMg: number | null
  /** Where the maintenance baseline came from. */
  basis: "nutrition_plan" | "bmr_estimate" | "unknown"
}

export interface WeightPlanData {
  plan: WeightPlan | null
  targets: WeightPlanTarget[]
  summary: WeightPlanSummary | null
  nutrition: WeightPlanNutrition | null
  /** Latest actual weigh-in (weight_logs) for current-vs-target + chart overlay. */
  latestWeight: WeightLog | null
  /** Recent weigh-ins for the projection chart's "actual" series. */
  recentWeights: WeightLog[]
  /** Current Low Base prescription (display section 4). */
  lowBase: LowBasePrescription | null
  /** Active nutrition plan (baseline + display section 5). */
  nutritionPlan: NutritionPlan | null
  /** Linked / next competition, if any. */
  competition: Competition | null
}

// ---- Daily Agenda (Phase 2C) -----------------------------------------------

export type AgendaItemType =
  | "calendar"
  | "competition"
  | "task"
  | "prescription"
  | "weight-plan"
  | "recovery"

export type AgendaItemPriority = "low" | "medium" | "high"

/** A normalized agenda entry aggregated from existing CoachOS data sources. */
export interface AgendaItem {
  id: string
  type: AgendaItemType
  title: string
  athleteId?: string
  athleteName?: string
  startsAt?: string // ISO datetime
  detail?: string
  href?: string
  priority: AgendaItemPriority
}

/** Attention-required counts + the underlying items for direct links. */
export interface AgendaAttention {
  unapprovedPrescriptions: number
  unreviewedMessages: number
  overdueTasks: number
  weightPlansBehind: number
  overdueTaskItems: AgendaItem[]
  behindPlanItems: AgendaItem[]
}

export interface AgendaDashboard {
  today: AgendaItem[]
  upcoming: AgendaItem[]
  attention: AgendaAttention
  timeZone: string
  generatedAt: string
}
export type AthleteCalendarEvent = Tables<"athlete_calendar_events">
export type AthleteCalendarEventOverride =
  Tables<"athlete_calendar_event_overrides">

/** A single (possibly recurrence-expanded) calendar occurrence on one day. */
export interface CalendarOccurrence {
  /** Stable per-occurrence id (`${event.id}` or `${event.id}@${date}`). */
  key: string
  event: AthleteCalendarEvent
  date: string // yyyy-MM-dd
  start: string // ISO datetime
  end: string | null
  /** Effective status = override.status (if one exists) else event.status. */
  status: CalendarStatus
  /** The per-occurrence override row, when this occurrence diverges. */
  override: AthleteCalendarEventOverride | null
}
export type ScheduledSession = Tables<"schedule_sessions">

// ---- Combat sports: typed protocol documents ------------------------------

/** A day in the water-loading taper leading into the cut. */
export interface WaterLoadDay {
  day_offset: number // days before weigh-in (e.g. 5 = 5 days out)
  label: string
  water_oz: number
  sodium?: string
  notes?: string
}

/** A timed step in the post-weigh-in rehydration protocol. */
export interface RehydrationStep {
  hour_offset: number // hours after weigh-in
  label: string
  fluid_oz: number
  electrolytes?: string
  notes?: string
}

/** A timed step in the post-weigh-in refueling protocol. */
export interface RefuelStep {
  hour_offset: number // hours after weigh-in
  label: string
  carbs_g?: number
  protein_g?: number
  sodium_mg?: number
  food?: string
  notes?: string
}

/** Weight cut with the jsonb protocol columns narrowed to typed arrays. */
export type WeightCut = Omit<
  Tables<"weight_cuts">,
  "water_load_plan" | "hydration_restoration" | "refuel_protocol"
> & {
  water_load_plan: WaterLoadDay[]
  hydration_restoration: RehydrationStep[]
  refuel_protocol: RefuelStep[]
}

// ---- Composite / view models ----------------------------------------------

export type TrainingSessionWithExercises = TrainingSession & {
  exercises: Exercise[]
}

export type CompetitionWithTasks = Competition & {
  tasks: CompetitionTask[]
}

export type MessageThreadWithLatest = MessageThread & {
  unreadCount: number
  latestMessage: Message | null
  client: Pick<Client, "id" | "first_name" | "last_name" | "avatar_url">
}

export interface ClientListItem {
  client: Client
  nextCompetition: Competition | null
  openAlertCount: number
  complianceScore: number
  /** Latest body-fat % for the roster card (null when no measurement). */
  latestBodyFatPct?: number | null
}

// ---- Body composition ------------------------------------------------------

/** The six tracked body-composition metrics (keys match weight_logs columns). */
export type BodyCompMetricKey =
  | "weight_lbs"
  | "body_fat_pct"
  | "body_fat_mass_lbs"
  | "bmr"
  | "total_body_water_lbs"
  | "skeletal_muscle_mass_lbs"

/** Current/previous/change + time series for one metric. */
export interface BodyCompMetricSummary {
  key: BodyCompMetricKey
  label: string
  unit: string
  current: number | null
  previous: number | null
  change: number | null
  series: { date: string; value: number }[]
}

export interface BodyCompositionData {
  logs: WeightLog[]
  goal: WeightGoal | null
  latest: WeightLog | null
  metrics: BodyCompMetricSummary[]
}

// ---- Measurements ----------------------------------------------------------

/** Circumference sites tracked per session (keys match body_measurements cols). */
export type MeasurementSiteKey =
  | "waist_in"
  | "hips_in"
  | "chest_in"
  | "shoulder_in"
  | "thigh_in"
  | "calves_in"
  | "wrist_in"
  | "ankle_in"
  | "neck_in"
  | "bicep_in"

/** Derived (computed, not stored) measurement metrics. */
export type MeasurementRatioKey = "hip_waist_ratio" | "waist_height_ratio"

export type MeasurementMetricKey = MeasurementSiteKey | MeasurementRatioKey

/** Current/previous/change + time series for one measurement metric. */
export interface MeasurementMetricSummary {
  key: MeasurementMetricKey
  label: string
  unit: string
  current: number | null
  previous: number | null
  change: number | null
  series: { date: string; value: number }[]
}

export interface MeasurementsData {
  logs: BodyMeasurement[]
  latest: BodyMeasurement | null
  /** Circumference site metrics (waist, hips, …). */
  sites: MeasurementMetricSummary[]
  /** Derived ratio metrics (Hip/Waist, Waist/Height). */
  ratios: MeasurementMetricSummary[]
}

// ---- Stat Tracker / Metabolic assessments ----------------------------------

/** The Low Base / training zone derived from the Set Point (MEP ± 10, rounded). */
export interface MetabolicZone {
  low: number
  high: number
}

/** An assessment plus its ordered curve points (by phase, then stage). */
export interface MetabolicAssessmentWithPoints extends MetabolicAssessment {
  points: MetabolicCurvePoint[]
}

/** "Tape" card — latest body-measurement values surfaced on the Stat Tracker. */
export interface StatTrackerTape {
  bicep_in: number | null
  neck_in: number | null
  /** Hip/Waist % = hips ÷ waist × 100 (see lib/metrics/measurements). */
  hipWaistPct: number | null
}

/** "Scale" card — latest body-composition values surfaced on the Stat Tracker. */
export interface StatTrackerScale {
  bodyFatPct: number | null
  bodyWaterLbs: number | null
  /** Lean Body Mass = weight − body-fat mass (lb). */
  leanBodyMassLbs: number | null
}

export interface MetabolicData {
  /** All assessments for the client, newest first. */
  assessments: MetabolicAssessment[]
  /** Most recent assessment (any source) with its curve points, or null. */
  latest: MetabolicAssessmentWithPoints | null
  /**
   * Most recent assessment that actually has curve points (the cart test that
   * produced the ventilation/HR curves), or null. Distinct from `latest` so a
   * newer scalar-only Manual Cart entry doesn't blank the curves.
   */
  latestCurve: MetabolicAssessmentWithPoints | null
  /** Most recent device ("Cart") assessment, or null. */
  latestCart: MetabolicAssessment | null
  /** Most recent manual ("Manual Cart") assessment, or null. */
  latestManual: MetabolicAssessment | null
  /** Zone = round(Set Point ± 10) from the latest assessment, or null. */
  zone: MetabolicZone | null
  /** The client's current Low Base prescription (push-MEP target), or null. */
  lowBase: LowBasePrescription | null
  /** Tape card (latest body_measurements). */
  tape: StatTrackerTape
  /** Scale card (latest weight_logs). */
  scale: StatTrackerScale
}

/** 360° snapshot powering the client overview page. */
export interface ClientSnapshot {
  client: Client
  latestWeight: WeightLog | null
  weightGoal: WeightGoal | null
  activeNutritionPlan: NutritionPlan | null
  hydrationToday: HydrationLog | null
  latestRecovery: RecoveryLog | null
  activeProgram: TrainingProgram | null
  nextCompetition: Competition | null
  openAlerts: Alert[]
  complianceScore: number // 0–100
}

/** Coach dashboard aggregate KPIs. */
export interface DashboardSummary {
  activeClients: number
  upcomingCompetitions: number
  openAlerts: number
  avgCompliance: number
  activeCuts: number
  todaysTasks: Task[]
  recentAlerts: Alert[]
}

// ---- Combat sports: readiness + composites --------------------------------

export type ReadinessLevel = "on_track" | "watch" | "at_risk"

/** Competition readiness — a weighted composite scored 0–100. */
export interface ReadinessScore {
  overall: number
  level: ReadinessLevel
  components: {
    weight: number // proximity to target, pace-adjusted
    hydration: number // 7-day hydration logging
    recovery: number // 7-day sleep/recovery quality
    training: number // recent session adherence
    safety: number // cut aggressiveness (higher = safer)
  }
  flags: string[]
  weightToGoLbs: number | null
  daysToWeighIn: number | null
  pctBodyweightToGo: number | null
}

/** A weight cut enriched with derived metrics for list/board views. */
export interface CombatCutListItem {
  cut: WeightCut
  client: Pick<
    Client,
    "id" | "first_name" | "last_name" | "avatar_url" | "sport"
  >
  latestWeightLbs: number | null
  readiness: ReadinessScore
  nextWeighIn: WeighIn | null
}

/** Full combat module view for a single client. */
export interface CombatCutDetail {
  cut: WeightCut
  weighIns: WeighIn[]
  latestWeightLbs: number | null
  readiness: ReadinessScore
  weightClass: WeightClass | null
}

// ---- Daily agenda ----------------------------------------------------------

export interface AgendaCompTask {
  id: string
  task: string
  dueDate: string | null
  competitionName: string
}

export type AgendaPriority = "urgent" | "attention" | "steady"

/** One athlete's full plan for a given day. */
export interface AthleteAgenda {
  client: Client
  training: TrainingSession[]
  caloriesTarget: number | null
  proteinTarget: number | null
  waterTargetOz: number | null
  supplements: Supplement[]
  recovery: {
    sleepTargetH: number
    latestSleepH: number | null
    latestSoreness: number | null
  }
  competitionTasks: AgendaCompTask[]
  reminders: Task[]
  weighInToday: boolean
  priority: AgendaPriority
  priorityReasons: string[]
  readiness: number | null
  compliance: number
  alerts: Alert[]
  isWeightCut: boolean
  isCompetition: boolean
  missedCheckIn: boolean
}

// ---- Athlete portal --------------------------------------------------------

export type AthleteDomain =
  | "weight"
  | "hydration"
  | "nutrition"
  | "supplements"
  | "recovery"

/** One domain's logged-state + a short human summary, for the Today checklist. */
export interface AthleteDomainStatus {
  domain: AthleteDomain
  label: string
  logged: boolean
  summary: string | null
}

export interface TodaySupplement {
  id: string
  name: string
  dosage: string | null
  timing: string | null
  taken: boolean
}

/** Everything the athlete's "Today" page needs: targets + today's entries. */
export interface AthleteToday {
  client: Client
  date: string // yyyy-MM-dd
  coachNotes: string | null
  weight: {
    target: number | null
    direction: "cut" | "bulk" | "maintain" | null
    loggedLbs: number | null
  }
  hydration: { targetOz: number | null; consumedOz: number }
  nutrition: {
    caloriesTarget: number | null
    proteinTarget: number | null
    carbsTarget: number | null
    fatTarget: number | null
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  }
  supplements: TodaySupplement[]
  recovery: {
    sleepHours: number | null
    soreness: number | null
    energy: number | null
    stress: number | null
    logged: boolean
  }
  domains: AthleteDomainStatus[]
  completionScore: number // 0–100
}

/** Athlete progress dashboard aggregate. */
export interface AthleteProgress {
  client: Client
  weightSeries: { date: string; weight: number }[]
  weightGoal: WeightGoal | null
  compliance: {
    weight: number
    hydration: number
    nutrition: number
    supplements: number
    recovery: number
    overall: number
  }
  streakDays: number
  last7Completion: { date: string; score: number }[]
}

// ---- Labs / biomarkers -----------------------------------------------------

export type BiomarkerCategory = "recovery" | "performance" | "blood" | "other"

/** Latest/previous/change + series for one biomarker (e.g. HRV, ferritin). */
export interface BiomarkerSummary {
  marker: string
  label: string
  unit: string | null
  category: string
  latest: number | null
  latestText: string | null // textual value when not numeric
  previous: number | null
  change: number | null
  measuredAt: string | null
  series: { date: string; value: number }[]
}

export interface BiomarkerCategoryGroup {
  category: string
  label: string
  markers: BiomarkerSummary[]
}

export interface BiomarkersData {
  client: Client
  groups: BiomarkerCategoryGroup[]
  totalReadings: number
  /** Newest-first raw readings for the editable "Recent readings" list. */
  recent: BiomarkerReading[]
}

// ---- Message ingestion / approval queue ------------------------------------

/** A suggested action enriched with its message + athlete, for the review queue. */
export interface ReviewQueueItem {
  id: string
  domain: SuggestionDomain
  intent: string | null
  suggestedProtocol: string
  confidence: number
  sensitive: boolean
  status: SuggestionStatus
  clientId: string | null
  athleteName: string | null
  matchMethod: MessageMatch
  matchConfidence: number
  source: MessageSource
  senderLabel: string | null
  messageSnippet: string
  receivedAt: string | null
  createdAt: string
  /** Structured payload for typed suggestions (e.g. weight-log entries). */
  details?: Record<string, unknown> | null
}

export interface InboxStats {
  pending: number
  sensitive: number
  unmatched: number
  approved: number
  rejected: number
}

export interface InboxData {
  items: ReviewQueueItem[]
  stats: InboxStats
}

// ---- Wrestling Command Center ----------------------------------------------

export type WrestlingPace = "on" | "off" | "unknown"
export type WrestlingRisk = "low" | "medium" | "high"

export interface WrestlingCutRow {
  cutId: string
  clientId: string
  name: string
  avatarUrl: string | null
  className: string | null
  classLimitLbs: number
  competitionAt: string | null
  weighInAt: string | null
  currentLbs: number | null
  targetLbs: number
  projectedLbs: number | null
  toGoLbs: number | null
  daysToWeighIn: number | null
  weeklyLossTargetLbs: number | null
  dailyLossTargetLbs: number | null
  dailyLossRateLbs: number | null
  pctBodyweightPerDay: number | null
  pace: WrestlingPace
  paceDeltaLbs: number | null
  risk: WrestlingRisk
  readiness: number
  hydrationPlan: RehydrationStep[]
}

export interface WrestlingCommandCenter {
  rows: WrestlingCutRow[]
  onPace: WrestlingCutRow[]
  offPace: WrestlingCutRow[]
  highRisk: WrestlingCutRow[]
  weighInsWithin14: WrestlingCutRow[]
  competitionsWithin30: WrestlingCutRow[]
}

// ---- Competition module ----------------------------------------------------

export type CompetitionEventSource = "cut" | "competition"

export interface CompetitionPrepTask {
  id: string
  task: string
  dueDate: string | null
  completed: boolean
}

/** A unified upcoming event (a weight cut or a standalone competition). */
export interface CompetitionEvent {
  id: string
  source: CompetitionEventSource
  clientId: string
  clientName: string
  avatarUrl: string | null
  sport: string | null
  name: string
  weightClass: string | null
  competitionAt: string | null
  weighInAt: string | null
  status: string
  daysToComp: number | null
  daysToWeighIn: number | null
  currentLbs: number | null
  targetLbs: number | null
  projectedLbs: number | null
  weeklyLossTargetLbs: number | null
  dailyLossTargetLbs: number | null
  cutRisk: WrestlingRisk | null
  readiness: number | null
  hydrationPlan: RehydrationStep[]
  fuelingReminders: RefuelStep[]
  prepTasks: CompetitionPrepTask[]
}

export interface CompetitionBoard {
  events: CompetitionEvent[]
  within7: number
  within30: number
  weighInsWithin14: number
  highRisk: number
}

// ---- Roster import ----------------------------------------------------------

/** One athlete row parsed from the roster CSV (the local "real roster"). */
export interface ImportedAthlete {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  sport: string | null
  weightClass: string | null
  currentWeight: number | null
  goalWeight: number | null
  nextCompetition: string | null
  competitionDate: string | null // yyyy-MM-dd
  coachNotes: string | null
  // Optional body-composition values from CSV import (seed the latest reading).
  bodyFatPct?: number | null
  bodyFatMassLbs?: number | null
  bmr?: number | null
  totalBodyWaterLbs?: number | null
  skeletalMuscleMassLbs?: number | null
}

// ---- Schedule module -------------------------------------------------------

/** Flat view model powering the schedule board (client name already resolved). */
export interface ScheduledSessionView {
  id: string
  clientId: string | null
  clientName: string | null
  avatarUrl: string | null
  title: string
  sessionType: ScheduleSessionType
  scheduledAt: string // ISO datetime
  durationMin: number
  location: string | null
  modality: SessionModality | null
  notes: string | null
  status: SessionStatus
}

/** Aggregate KPIs for the schedule page header. */
export interface ScheduleSummary {
  today: number
  thisWeek: number
  completionRate: number // 0–100
  upcoming: number
}

// ---- Tasks -----------------------------------------------------------------

export type TaskType =
  | "nutrition"
  | "hydration"
  | "supplements"
  | "recovery"
  | "weight_cut"
  | "competition"
  | "communication"
  | "training"
  | "general"

export interface CoachTaskView {
  id: string
  clientId: string | null
  clientName: string | null
  title: string
  description: string | null
  type: TaskType
  status: TaskStatus
  priority: Priority
  dueDate: string | null // yyyy-MM-dd
  completedAt: string | null
}

// ---- Calendar --------------------------------------------------------------

export type CalendarEventType =
  | "competition"
  | "weigh_in"
  | "check_in"
  | "training"
  | "consultation"
  | "follow_up"

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  date: string // ISO datetime
  clientId: string | null
  clientName: string | null
  detail: string | null
  durationMin: number | null
  /** Effective status for athlete-calendar roll-ups (undefined for others). */
  status?: CalendarStatus
}

// ---- Settings --------------------------------------------------------------

export interface SupplementDefault {
  name: string
  dosage: string
  timing: string
}

export interface CoachSettingsData {
  coach: {
    fullName: string
    email: string
    phone: string
    timezone: string
  }
  business: {
    name: string
    location: string
    website: string
  }
  notifications: {
    emailAlerts: boolean
    smsAlerts: boolean
    weeklyDigest: boolean
    dailyAgenda: boolean
  }
  nutritionDefaults: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  hydrationDefaults: {
    ozTarget: number
  }
  supplementDefaults: SupplementDefault[]
  alertThresholds: {
    missedWeighInDays: number
    lowHydrationPct: number
    poorSleepHours: number
    highSoreness: number
    lowProteinPct: number
  }
  weightCutDefaults: {
    maxPctPerDay: number
    rehydrationWindowHours: number
    waterLoadDays: number
  }
  devMode: {
    authBypass: boolean
  }
}
