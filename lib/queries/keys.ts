// Centralized React Query key factory. Keeps cache keys consistent + typo-free.

export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["clients", "list", filters ?? {}] as const,
    detail: (clientId: string) => ["clients", clientId] as const,
    snapshot: (clientId: string) => ["clients", clientId, "snapshot"] as const,
  },
  weight: {
    logs: (clientId: string) => ["weight", clientId, "logs"] as const,
    goal: (clientId: string) => ["weight", clientId, "goal"] as const,
  },
  nutrition: {
    plans: (clientId: string) => ["nutrition", clientId, "plans"] as const,
    logs: (clientId: string, date?: string) =>
      ["nutrition", clientId, "logs", date ?? "all"] as const,
  },
  hydration: {
    logs: (clientId: string) => ["hydration", clientId, "logs"] as const,
  },
  supplements: {
    list: (clientId: string) => ["supplements", clientId] as const,
    logs: (clientId: string) => ["supplements", clientId, "logs"] as const,
  },
  recovery: {
    logs: (clientId: string) => ["recovery", clientId, "logs"] as const,
  },
  training: {
    programs: (clientId: string) => ["training", clientId, "programs"] as const,
    sessions: (clientId: string) => ["training", clientId, "sessions"] as const,
  },
  competitions: {
    list: (clientId: string) => ["competitions", clientId] as const,
    detail: (competitionId: string) =>
      ["competitions", "detail", competitionId] as const,
  },
  messages: {
    threads: ["messages", "threads"] as const,
    thread: (threadId: string) => ["messages", "thread", threadId] as const,
  },
  communications: {
    list: (clientId: string) => ["communications", clientId] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["tasks", "list", filters ?? {}] as const,
  },
  alerts: {
    all: ["alerts"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["alerts", "list", filters ?? {}] as const,
  },
  dashboard: {
    summary: ["dashboard", "summary"] as const,
  },
} as const
