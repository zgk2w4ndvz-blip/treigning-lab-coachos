// ============================================================================
// transform.ts — raw-backup/athletes.json → CoachOS-shaped rows in out/.
// Pure: no network, no DB. Run this after scrape (or on the sample).
//
//   npx tsx tools/treigning-import/transform.ts [inputJsonPath]
//   (default input: raw-backup/athletes.json)
// ============================================================================

import fs from "node:fs"
import path from "node:path"

import { mapAthlete } from "./config"
import type { ImportRow, RawAthlete } from "./types"

const IN = process.argv[2] ?? path.join(__dirname, "raw-backup", "athletes.json")
const OUT_DIR = path.join(__dirname, "out")

function csvField(v: unknown): string {
  if (v == null) return ""
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: ImportRow[]): string {
  const headers = [
    "first_name", "last_name", "email", "phone", "sport",
    "current_weight_class", "current_weight", "goal_weight",
    "next_competition", "competition_date", "notes",
    "weight_lbs", "body_fat_pct", "body_fat_mass_lbs",
    "skeletal_muscle_mass_lbs", "total_body_water_lbs", "bmr",
  ]
  const lines = [headers.join(",")]
  for (const r of rows) {
    const b = r.bodyComp
    lines.push([
      r.client.first_name, r.client.last_name, r.client.email, r.client.phone,
      r.client.sport, r.client.current_weight_class, r.client.current_weight,
      r.client.goal_weight, r.client.next_competition, r.client.competition_date,
      r.client.notes, b?.weight_lbs, b?.body_fat_pct, b?.body_fat_mass_lbs,
      b?.skeletal_muscle_mass_lbs, b?.total_body_water_lbs, b?.bmr,
    ].map(csvField).join(","))
  }
  return lines.join("\n")
}

function main() {
  if (!fs.existsSync(IN)) {
    console.error(`✗ Input not found: ${IN}\n  Run scrape.ts first, or pass a path (e.g. sample/athletes.sample.json).`)
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(IN, "utf8")) as RawAthlete[]
  if (!Array.isArray(raw)) {
    console.error("✗ Input must be a JSON array of athlete objects.")
    process.exit(1)
  }

  const mapped = raw.map(mapAthlete)
  const valid = mapped.filter((r) => r.client.first_name || r.client.last_name)
  const skipped = mapped.length - valid.length

  // Warn on in-batch duplicates (same email or name appearing twice).
  const seen = new Map<string, number>()
  const dupes: string[] = []
  for (const r of valid) {
    const key = r.email ?? r.nameKey
    seen.set(key, (seen.get(key) ?? 0) + 1)
    if (seen.get(key) === 2) dupes.push(key)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, "coachos-rows.json"), JSON.stringify(valid, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, "coachos-clients.csv"), toCsv(valid))
  fs.writeFileSync(
    path.join(OUT_DIR, "unmapped-biomarkers.json"),
    JSON.stringify(
      valid.map((r) => ({ name: `${r.client.first_name} ${r.client.last_name}`, fields: r.unmappedBiomarkers })),
      null, 2
    )
  )
  // Structured biomarker readings, ready for biomarker_readings (labs vertical).
  fs.writeFileSync(
    path.join(OUT_DIR, "coachos-biomarkers.json"),
    JSON.stringify(
      valid.map((r) => ({ name: `${r.client.first_name} ${r.client.last_name}`, email: r.email, readings: r.biomarkers })),
      null, 2
    )
  )

  const withBodyComp = valid.filter((r) => r.bodyComp).length
  const withEmail = valid.filter((r) => r.email).length
  const biomarkerCount = valid.reduce((n, r) => n + r.biomarkers.length, 0)
  console.log("Transform complete:")
  console.log(`  input records      : ${raw.length}`)
  console.log(`  valid (has a name) : ${valid.length}`)
  console.log(`  skipped (no name)  : ${skipped}`)
  console.log(`  with email         : ${withEmail}`)
  console.log(`  with body comp     : ${withBodyComp}`)
  console.log(`  biomarker readings : ${biomarkerCount}`)
  console.log(`  in-batch dupe keys : ${dupes.length}${dupes.length ? ` (${dupes.join(", ")})` : ""}`)
  console.log(`\n  wrote out/coachos-rows.json, out/coachos-clients.csv, out/coachos-biomarkers.json, out/unmapped-biomarkers.json`)
  console.log(`  next: dry-run the DB plan →  npx tsx tools/treigning-import/upsert.ts`)
}

main()
