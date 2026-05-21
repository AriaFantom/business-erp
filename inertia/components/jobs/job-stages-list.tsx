import { Badge } from '@/components/ui/badge'
import { JobCountdown } from './job-countdown'

export interface StageView {
  id: number
  sequence: number
  name: string
  estimatedDurationMin: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  autoCompleteAt: string | null
}

export function JobStagesList({
  stages,
  paused,
  remainingSeconds,
  serverNow,
}: {
  stages: StageView[]
  paused: boolean
  remainingSeconds: number | null
  serverNow?: string
}) {
  return (
    <ol className="space-y-2">
      {stages.map((s) => (
        <li key={s.id} className="flex items-center justify-between rounded border p-3">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-sm">{s.sequence}.</span>
            <span className="font-medium">{s.name}</span>
            <Badge variant={badgeVariant(s.status)}>{s.status}</Badge>
            <span className="text-muted-foreground text-sm">{s.estimatedDurationMin} min</span>
          </div>
          {s.status === 'in_progress' ? (
            <JobCountdown
              autoCompleteAt={s.autoCompleteAt}
              remainingSeconds={remainingSeconds}
              paused={paused}
              serverNow={serverNow}
            />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function badgeVariant(s: StageView['status']) {
  if (s === 'completed') return 'default' as const
  if (s === 'in_progress') return 'secondary' as const
  if (s === 'skipped') return 'outline' as const
  return 'outline' as const
}
