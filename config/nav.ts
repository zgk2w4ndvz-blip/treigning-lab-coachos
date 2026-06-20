import {
  LayoutDashboard,
  CalendarCheck,
  Inbox,
  Users,
  ListTodo,
  Bell,
  CalendarDays,
  Settings,
  Scale,
  Utensils,
  Droplets,
  Pill,
  HeartPulse,
  FlaskConical,
  ClipboardList,
  Dumbbell,
  Trophy,
  MessageSquare,
  Swords,
  Medal,
  CalendarClock,
  Activity,
  Ruler,
  Gauge,
  Target,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

/** Coach sidebar navigation — flat list (used by the mobile topbar menu). */
export const coachNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarCheck },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Combat Sports", href: "/combat", icon: Swords },
  { label: "Wrestling", href: "/wrestling", icon: Medal },
  { label: "Competitions", href: "/competitions", icon: Trophy },
  { label: "Schedule", href: "/schedule", icon: CalendarClock },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Settings", href: "/settings", icon: Settings },
]

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Grouped coach sidebar nav (command-center sections). Settings is pinned in
 *  the sidebar footer, so it is intentionally excluded here. */
export const coachNavGroups: NavGroup[] = [
  {
    label: "Command",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Agenda", href: "/agenda", icon: CalendarCheck },
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Alerts", href: "/alerts", icon: Bell },
    ],
  },
  {
    label: "Athletes",
    items: [{ label: "Clients", href: "/clients", icon: Users }],
  },
  {
    label: "Programming",
    items: [
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
      { label: "Schedule", href: "/schedule", icon: CalendarClock },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
    ],
  },
  {
    label: "Sport",
    items: [
      { label: "Competitions", href: "/competitions", icon: Trophy },
      { label: "Combat Sports", href: "/combat", icon: Swords },
      { label: "Wrestling", href: "/wrestling", icon: Medal },
    ],
  },
]

/** Settings — pinned to the sidebar footer. */
export const coachSettingsNav: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
}

export interface ClientTab {
  label: string
  segment: string
  icon: LucideIcon
}

/** Per-client tab navigation (relative to /clients/[clientId]). */
export const clientTabs: ClientTab[] =
  [
    { label: "Overview", segment: "", icon: LayoutDashboard },
    { label: "Calendar", segment: "calendar", icon: CalendarDays },
    { label: "Body Comp", segment: "weight", icon: Scale },
    { label: "Measurements", segment: "measurements", icon: Ruler },
    { label: "Labs", segment: "labs", icon: FlaskConical },
    { label: "Rx", segment: "prescriptions", icon: ClipboardList },
    { label: "Nutrition", segment: "nutrition", icon: Utensils },
    { label: "Hydration", segment: "hydration", icon: Droplets },
    { label: "Supplements", segment: "supplements", icon: Pill },
    { label: "Recovery", segment: "recovery", icon: HeartPulse },
    { label: "Stat Tracker", segment: "metabolic", icon: Gauge },
    { label: "Low Base", segment: "low-base", icon: Activity },
    { label: "Weight Plan", segment: "weight-plan", icon: Target },
    { label: "Training", segment: "training", icon: Dumbbell },
    { label: "Competitions", segment: "competitions", icon: Trophy },
    { label: "Combat", segment: "combat", icon: Swords },
    { label: "Conversation", segment: "messages", icon: MessageSquare },
  ]

export interface ClientTabGroup {
  label: string
  tabs: ClientTab[]
}

/** Grouped per-client tabs (Overview / Daily / Performance / Fuel / Health /
 *  Competition). Collapses the flat 17-tab strip into 6 scannable groups.
 *  HTMA is omitted until the labs vertical ships. */
export const clientTabGroups: ClientTabGroup[] = [
  {
    label: "Overview",
    tabs: [{ label: "Overview", segment: "", icon: LayoutDashboard }],
  },
  {
    label: "Daily",
    tabs: [
      { label: "Calendar", segment: "calendar", icon: CalendarDays },
      { label: "Conversation", segment: "messages", icon: MessageSquare },
    ],
  },
  {
    label: "Performance",
    tabs: [
      { label: "Body Comp", segment: "weight", icon: Scale },
      { label: "Measurements", segment: "measurements", icon: Ruler },
      { label: "Stat Tracker", segment: "metabolic", icon: Gauge },
      { label: "Low Base", segment: "low-base", icon: Activity },
      { label: "Weight Plan", segment: "weight-plan", icon: Target },
      { label: "Training", segment: "training", icon: Dumbbell },
    ],
  },
  {
    label: "Fuel",
    tabs: [
      { label: "Nutrition", segment: "nutrition", icon: Utensils },
      { label: "Hydration", segment: "hydration", icon: Droplets },
      { label: "Supplements", segment: "supplements", icon: Pill },
      { label: "Rx", segment: "prescriptions", icon: ClipboardList },
    ],
  },
  {
    label: "Health",
    tabs: [
      { label: "Recovery", segment: "recovery", icon: HeartPulse },
      { label: "Labs", segment: "labs", icon: FlaskConical },
    ],
  },
  {
    label: "Competition",
    tabs: [
      { label: "Competitions", segment: "competitions", icon: Trophy },
      { label: "Combat", segment: "combat", icon: Swords },
    ],
  },
]

/** Athlete (client portal) navigation. */
export const clientPortalNav: NavItem[] = [
  { label: "Today", href: "/today", icon: LayoutDashboard },
  { label: "My Plan", href: "/plan", icon: Dumbbell },
  { label: "Competitions", href: "/competitions", icon: Trophy },
  { label: "Messages", href: "/messages", icon: MessageSquare },
]
