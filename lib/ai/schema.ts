// The structured-output contract for AI message extraction. The model returns a
// list of typed suggestions; we validate with zod and then map to the existing
// ClassifiedSuggestion shape so output flows through the SAME pending-suggestion
// pipeline (no new write surface). The hand-written JSON Schema below is passed
// as the Claude tool `input_schema` (all keys required; additionalProperties:
// false; optional fields modelled as nullable) so a forced tool call yields the
// structured object directly.

import { z } from "zod"

export const AI_DOMAINS = [
  "diet",
  "supplementation",
  "altolab",
  "low_base",
  "hydration",
  "recovery",
  "labs",
  "training",
  "body_composition",
] as const

export const AI_ACTIONS = [
  "create_weight_log",
  "body_composition_update",
  "metabolic_assessment",
  "nutrition_prescription",
  "low_base_prescription",
  "observation", // recovery / injury / schedule-change / generic note
] as const

const numOrNull = z.number().nullable()

const fieldsSchema = z.object({
  // weight
  entries: z
    .array(z.object({ label: z.enum(["morning", "evening", "general"]), weightLbs: z.number() }))
    .nullable(),
  weight_lbs: numOrNull,
  // body composition (InBody)
  body_fat_percentage: numOrNull,
  skeletal_muscle_mass_lbs: numOrNull,
  body_fat_mass_lbs: numOrNull,
  total_body_water_lbs: numOrNull,
  bmr: numOrNull,
  // metabolic biometrics
  vo2_max: numOrNull,
  mep_bpm: numOrNull,
  aerobic_threshold_bpm: numOrNull,
  max_hr_bpm: numOrNull,
  // nutrition
  calories: numOrNull,
  protein_g: numOrNull,
  carbs_g: numOrNull,
  fat_g: numOrNull,
  // low base dose
  minutes_per_session: numOrNull,
  frequency_per_week: numOrNull,
})

export const aiSuggestionSchema = z.object({
  domain: z.enum(AI_DOMAINS),
  intent: z.string(),
  protocol: z.string(),
  confidence: z.number(),
  sensitive: z.boolean(),
  action: z.enum(AI_ACTIONS),
  fields: fieldsSchema,
})

export const aiExtractionSchema = z.object({
  suggestions: z.array(aiSuggestionSchema),
})

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>
export type AiExtraction = z.infer<typeof aiExtractionSchema>

// ---- JSON schema used as the Claude tool input_schema ----------------------
const NUM_NULL = { type: ["number", "null"] } as const

export const AI_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["domain", "intent", "protocol", "confidence", "sensitive", "action", "fields"],
        properties: {
          domain: { type: "string", enum: [...AI_DOMAINS] },
          intent: { type: "string" },
          protocol: { type: "string" },
          confidence: { type: "number" },
          sensitive: { type: "boolean" },
          action: { type: "string", enum: [...AI_ACTIONS] },
          fields: {
            type: "object",
            additionalProperties: false,
            required: [
              "entries", "weight_lbs", "body_fat_percentage", "skeletal_muscle_mass_lbs",
              "body_fat_mass_lbs", "total_body_water_lbs", "bmr", "vo2_max", "mep_bpm",
              "aerobic_threshold_bpm", "max_hr_bpm", "calories", "protein_g", "carbs_g",
              "fat_g", "minutes_per_session", "frequency_per_week",
            ],
            properties: {
              entries: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "weightLbs"],
                  properties: {
                    label: { type: "string", enum: ["morning", "evening", "general"] },
                    weightLbs: { type: "number" },
                  },
                },
              },
              weight_lbs: NUM_NULL,
              body_fat_percentage: NUM_NULL,
              skeletal_muscle_mass_lbs: NUM_NULL,
              body_fat_mass_lbs: NUM_NULL,
              total_body_water_lbs: NUM_NULL,
              bmr: NUM_NULL,
              vo2_max: NUM_NULL,
              mep_bpm: NUM_NULL,
              aerobic_threshold_bpm: NUM_NULL,
              max_hr_bpm: NUM_NULL,
              calories: NUM_NULL,
              protein_g: NUM_NULL,
              carbs_g: NUM_NULL,
              fat_g: NUM_NULL,
              minutes_per_session: NUM_NULL,
              frequency_per_week: NUM_NULL,
            },
          },
        },
      },
    },
  },
} as const
