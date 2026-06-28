"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, User, ArrowRight } from "lucide-react"

export interface PaletteAthlete {
  id: string
  name: string
}

interface Result {
  id: string
  label: string
  sub?: string
  href: string
  group: "Athletes" | "Go to"
}

const PAGES: { label: string; href: string }[] = [
  { label: "Mission Control", href: "/dashboard" },
  { label: "Inbox", href: "/inbox" },
  { label: "Athletes", href: "/clients" },
  { label: "Reports", href: "/reports" },
  { label: "Notifications", href: "/notifications" },
  { label: "Calendar", href: "/calendar" },
  { label: "Competitions", href: "/competitions" },
  { label: "Tasks", href: "/tasks" },
  { label: "Alerts", href: "/alerts" },
  { label: "Settings", href: "/settings" },
]

// Global command palette (⌘K). Client-only, opens over any coach page. Fuzzy
// search across the roster (passed from the layout) + navigation. Read-only — it
// only navigates; no data writes. Opens on ⌘K/Ctrl-K or the `open-command-palette`
// window event (dispatched by the topbar search button).
export function CommandPalette({ roster }: { roster: PaletteAthlete[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setSel(0)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("open-command-palette", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("open-command-palette", onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const athletes = roster
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map<Result>((a) => ({ id: `a-${a.id}`, label: a.name, sub: "Athlete", href: `/clients/${a.id}`, group: "Athletes" }))
    const pages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q)).map<Result>((p) => ({
      id: `p-${p.href}`,
      label: p.label,
      href: p.href,
      group: "Go to",
    }))
    return [...athletes, ...pages]
  }, [query, roster])

  useEffect(() => setSel(0), [query])

  function go(r: Result | undefined) {
    if (!r) return
    close()
    router.push(r.href)
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      go(results[sel])
    }
  }

  if (!open) return null

  let lastGroup = ""

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-[12vh]"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-frame border border-ds-border-strong bg-ds-surface-1"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 border-b border-ds-border px-4 py-3">
          <Search className="size-4 text-ds-text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search athletes, pages…"
            aria-label="Search"
            className="flex-1 bg-transparent text-sm text-ds-text-primary outline-none placeholder:text-ds-text-muted"
          />
          <kbd className="rounded border border-ds-border-strong bg-ds-surface-page px-1.5 py-0.5 text-[10px] text-ds-text-secondary">
            ⌘K
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ds-text-muted">No matches.</p>
          ) : (
            results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null
              lastGroup = r.group
              const active = i === sel
              return (
                <div key={r.id}>
                  {header ? (
                    <div className="px-4 pt-2 pb-1 text-[11px] text-ds-text-muted">{header}</div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => go(r)}
                    onMouseEnter={() => setSel(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${active ? "bg-ds-primary-bg" : ""}`}
                  >
                    {r.group === "Athletes" ? (
                      <User className="size-4 text-ds-text-secondary" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="size-4 text-ds-text-secondary" aria-hidden="true" />
                    )}
                    <span className="flex-1 text-sm text-ds-text-primary">{r.label}</span>
                    {r.sub ? <span className="text-xs text-ds-text-muted">{r.sub}</span> : null}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
