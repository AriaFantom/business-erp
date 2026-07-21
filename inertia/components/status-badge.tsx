import { Badge } from '@/components/ui/badge'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

/**
 * Central status → badge-variant map for the money-loop entities. Keeps colors
 * consistent across list and detail pages; previously every page redefined its
 * own `statusVariant` helper, which drifted.
 */
export type StatusKind = 'quotation' | 'order' | 'invoice' | 'purchase' | 'job'

const MAPS: Record<StatusKind, Record<string, Variant>> = {
  quotation: {
    draft: 'outline',
    sent: 'secondary',
    accepted: 'default',
    converted: 'default',
    rejected: 'destructive',
    expired: 'destructive',
  },
  order: {
    draft: 'outline',
    confirmed: 'default',
    cancelled: 'destructive',
  },
  invoice: {
    paid: 'default',
    partial: 'outline',
    void: 'secondary',
    unpaid: 'destructive',
  },
  purchase: {
    draft: 'outline',
    confirmed: 'default',
    cancelled: 'secondary',
  },
  job: {
    draft: 'outline',
    queued: 'outline',
    paused: 'outline',
    in_progress: 'secondary',
    completed: 'default',
    failed: 'destructive',
    cancelled: 'destructive',
  },
}

export function statusVariant(kind: StatusKind, status: string): Variant {
  return MAPS[kind][status] ?? 'outline'
}

/** Humanize a status token: `in_progress` → `In progress`. */
function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function StatusBadge({ kind, status }: { kind: StatusKind; status: string }) {
  return <Badge variant={statusVariant(kind, status)}>{statusLabel(status)}</Badge>
}
