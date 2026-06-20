interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight uppercase">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** A bold, uppercase section label for the dashboard/agenda command center. */
export function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-heading text-muted-foreground text-xs font-semibold tracking-widest uppercase">
        {title}
      </h2>
      {action}
    </div>
  )
}
