import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  /** Optional leading icon (lucide). */
  icon?: LucideIcon
  /** Short headline, e.g. "No sales yet". */
  title: string
  /** Optional supporting line explaining what to do next. */
  description?: string
  /** Optional call-to-action — typically a "New …" dialog trigger or a Link button. */
  action?: ReactNode
  className?: string
}

/**
 * Consistent empty-list placeholder. Replaces the ad-hoc
 * `<p className="text-sm text-muted-foreground">No … yet.</p>` lines so empty
 * pages can offer a clear next step instead of a dead end.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {Icon ? (
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
