import type { Metadata } from "next"
import { Geist, Geist_Mono, Oswald } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

import { QueryProvider } from "@/providers/query-provider"
import { Toaster } from "@/components/ui/sonner"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Athletic condensed display font for headings (Treigning Lab visual system).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Treigning Lab CoachOS",
  description:
    "Coaching command center for athlete performance, nutrition, recovery, and competition prep.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const tree = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        {DEV_AUTH_BYPASS ? (
          <div className="bg-amber-500 text-amber-950 px-4 py-1 text-center text-xs font-medium">
            Dev mode — auth bypassed, showing mock data. Set
            NEXT_PUBLIC_DEV_AUTH_BYPASS=false to disable.
          </div>
        ) : null}
        <QueryProvider>{children}</QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )

  // Skip ClerkProvider in dev bypass so no real Clerk key is needed.
  return DEV_AUTH_BYPASS ? tree : <ClerkProvider>{tree}</ClerkProvider>
}
