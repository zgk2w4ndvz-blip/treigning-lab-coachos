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
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

/** Coach sidebar navigation. */
export const coachNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Daily Agenda", href: "/agenda", icon: CalendarCheck },
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

/** Per-client tab navigation (relative to /clients/[clientId]). */
export const clientTabs: { label: string; segment: string; icon: LucideIcon }[] =
  [
    { label: "Overview", segment: "", icon: LayoutDashboard },
    { label: "Calendar", segment: "calendar", icon: CalendarDays },
    { label: "Body Comp", segment: "weight", icon: Scale },
    { label: "Labs", segment: "labs", icon: FlaskConical },
    { label: "Rx", segment: "prescriptions", icon: ClipboardList },
    { label: "Nutrition", segment: "nutrition", icon: Utensils },
    { label: "Hydration", segment: "hydration", icon: Droplets },
    { label: "Supplements", segment: "supplements", icon: Pill },
    { label: "Recovery", segment: "recovery", icon: HeartPulse },
    { label: "Training", segment: "training", icon: Dumbbell },
    { label: "Competitions", segment: "competitions", icon: Trophy },
    { label: "Combat", segment: "combat", icon: Swords },
    { label: "Messages", segment: "messages", icon: MessageSquare },
  ]

/** Athlete (client portal) navigation. */
export const clientPortalNav: NavItem[] = [
  { label: "Today", href: "/today", icon: LayoutDashboard },
  { label: "My Plan", href: "/plan", icon: Dumbbell },
  { label: "Competitions", href: "/competitions", icon: Trophy },
  { label: "Messages", href: "/messages", icon: MessageSquare },
]
