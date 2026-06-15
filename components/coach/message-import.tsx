"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Upload, Sparkles } from "lucide-react"

import { ingestMessagesAction } from "@/lib/actions/inbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

const SAMPLE = `source,sender_name,sender_phone,sender_email,received_at,body
imessage,Jordan Vance,(555) 201-7788,,2026-06-14,"Cramping late in sessions — should I add electrolytes and more water?"
gmail,Maya Okafor,,maya.okafor@example.com,2026-06-14,"Can I bump creatine to 10g and add magnesium at night?"
sms,,+1 555 999 0000,,2026-06-13,"Super sore and slept badly, think I need a lighter day"`

export function MessageImport() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [format, setFormat] = useState<"auto" | "csv" | "json">("auto")
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function ingest() {
    start(async () => {
      try {
        const hint = format === "auto" ? undefined : format
        const res = await ingestMessagesAction(text, hint)
        if (res.ok) {
          toast.success(
            `Ingested ${res.messageCount} message(s) → ${res.suggestionCount} suggestion(s); ${res.matched} matched to athletes.`
          )
          if (res.rowErrors?.length) toast.message(`${res.rowErrors.length} note(s) during import.`)
          setText("")
          router.refresh()
        } else {
          toast.error(res.error ?? "Import failed.")
        }
      } catch {
        toast.error("Couldn't reach the server — please try again.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import messages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Paste or upload a CSV/JSON export (Gmail, SMS/iMessage, WhatsApp, or manual).
          Columns: <code className="text-xs">source, sender_name, sender_phone, sender_email, received_at, body</code>.
          Messages are matched to athletes and classified into suggested actions —
          nothing is prescribed until you approve it.
        </p>
        <input
          ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) { const r = new FileReader(); r.onload = () => setText(String(r.result ?? "")); r.readAsText(f) }
            e.target.value = ""
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Upload file
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>Load sample</Button>
          <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="source,sender_name,...&#10;..."
          rows={6}
          className="font-mono text-xs"
        />
        <div className="flex justify-end">
          <Button onClick={ingest} disabled={pending || text.trim().length === 0}>
            <Sparkles className="size-4" />
            {pending ? "Ingesting…" : "Ingest & suggest"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
