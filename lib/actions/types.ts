// Shared action result type + constants. NOT a "use server" module, so it may
// export non-function values (which server-action files cannot).

export type ActionState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

/** Mutations are read-only in dev bypass mode (mock data). */
export const BYPASS_BLOCKED: ActionState = {
  ok: false,
  error: "Disabled in dev bypass mode — mock data is read-only.",
}
