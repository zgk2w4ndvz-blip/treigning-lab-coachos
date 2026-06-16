// Category labels + colors for the athlete calendar. Client-safe (no I/O).

import type { CalendarCategory } from "@/types/models"

export interface CategoryMeta {
  label: string
  /** Tailwind classes for an event chip. */
  chip: string
  /** Tailwind bg class for a legend / month dot. */
  dot: string
}

export const CATEGORY_META: Record<CalendarCategory, CategoryMeta> = {
  strength: { label: "Strength", chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300", dot: "bg-indigo-500" },
  conditioning: { label: "Conditioning", chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", dot: "bg-orange-500" },
  sport: { label: "Sport", chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", dot: "bg-blue-500" },
  low_base: { label: "Low Base", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", dot: "bg-sky-500" },
  supplementation: { label: "Supplementation", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", dot: "bg-violet-500" },
  altolab: { label: "AltoLab", chip: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300", dot: "bg-cyan-500" },
  nutrition: { label: "Nutrition", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", dot: "bg-amber-500" },
  hydration: { label: "Hydration", chip: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300", dot: "bg-teal-500" },
  recovery: { label: "Recovery", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-emerald-500" },
  testing: { label: "Testing", chip: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300", dot: "bg-fuchsia-500" },
  labs: { label: "Labs", chip: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300", dot: "bg-purple-500" },
  weigh_in: { label: "Body Composition", chip: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", dot: "bg-rose-500" },
  competition: { label: "Competition", chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", dot: "bg-red-500" },
  check_in: { label: "Check-in", chip: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300", dot: "bg-lime-500" },
  note: { label: "Note", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-500" },
}

export const CATEGORY_ORDER = Object.keys(CATEGORY_META) as CalendarCategory[]
