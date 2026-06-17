// Pure mapping from a body_composition_update suggestion payload to the
// weight_logs columns to write on approval. Kept separate from the server
// action so it is unit-testable. NEVER includes weight_lbs unless the payload
// itself carries one — so approving a body-comp update never silently changes
// the athlete's weight.

export interface BodyCompPayload {
  action?: string
  body_fat_percentage?: number
  skeletal_muscle_mass_lbs?: number
  body_fat_mass_lbs?: number
  total_body_water_lbs?: number
  bmr?: number
  weight_lbs?: number
}

export interface WeightLogCompFields {
  body_fat_pct?: number
  skeletal_muscle_mass_lbs?: number
  muscle_mass_lbs?: number
  body_fat_mass_lbs?: number
  total_body_water_lbs?: number
  bmr?: number
  weight_lbs?: number
}

/** The weight_logs columns to set for a body-composition update. Only includes
 *  fields present in the payload (so an update never nulls existing data). */
export function bodyCompToWeightLogFields(d: BodyCompPayload): WeightLogCompFields {
  const out: WeightLogCompFields = {}
  if (d.body_fat_percentage != null) out.body_fat_pct = d.body_fat_percentage
  if (d.skeletal_muscle_mass_lbs != null) {
    out.skeletal_muscle_mass_lbs = d.skeletal_muscle_mass_lbs
    out.muscle_mass_lbs = d.skeletal_muscle_mass_lbs // keep the legacy column in sync
  }
  if (d.body_fat_mass_lbs != null) out.body_fat_mass_lbs = d.body_fat_mass_lbs
  if (d.total_body_water_lbs != null) out.total_body_water_lbs = d.total_body_water_lbs
  if (d.bmr != null) out.bmr = d.bmr
  if (d.weight_lbs != null) out.weight_lbs = d.weight_lbs // only when explicitly provided
  return out
}
