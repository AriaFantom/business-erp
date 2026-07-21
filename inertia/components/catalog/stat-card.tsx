import type { LucideIcon } from 'lucide-react'
import { Link } from '@adonisjs/inertia/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  href?: string
  active?: boolean
}

export function StatCard({ label, value, hint, icon: Icon, href, active }: Props) {
  const card = (
    <Card
      className={cn(
        'h-full transition-colors',
        href && 'cursor-pointer hover:border-primary/40 hover:bg-accent/40',
        active && 'border-primary/60 bg-accent/40'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      preserveScroll
      preserveState
      replace
      aria-pressed={active ? 'true' : 'false'}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
    >
      {card}
    </Link>
  )
}
