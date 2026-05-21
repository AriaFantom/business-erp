import { useEffect, useState } from 'react'
import type { StageView } from './job-stages-list'

interface Props {
  stages: StageView[]
  paused: boolean
  remainingSeconds: number | null
  startedAt: string | null
  autoCompleteAt: string | null
  estimatedDurationMin: number | null
  serverNow: string
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

export function JobProgress({
  stages,
  paused,
  remainingSeconds,
  startedAt,
  autoCompleteAt,
  estimatedDurationMin,
  serverNow,
}: Props) {
  // Anchor "now" to the server clock to avoid client/server skew making the
  // bar start at the wrong percent on a freshly started job.
  const [skewMs] = useState(() => new Date(serverNow).getTime() - Date.now())
  const [clientNow, setClientNow] = useState(() => Date.now())
  const now = clientNow + skewMs

  const active = stages.find((s) => s.status === 'in_progress') ?? null
  const tickTarget = active?.autoCompleteAt ?? autoCompleteAt

  useEffect(() => {
    if (paused) return
    if (!tickTarget && !startedAt) return
    const id = setInterval(() => setClientNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused, tickTarget, startedAt])

  // --- stage-based path ---
  if (stages.length > 0) {
    const totalSeconds = stages.reduce((acc, s) => acc + s.estimatedDurationMin * 60, 0)

    let activeRemaining = 0
    if (active) {
      if (paused && remainingSeconds !== null) {
        activeRemaining = Math.max(0, remainingSeconds)
      } else if (active.autoCompleteAt) {
        activeRemaining = Math.max(0, (new Date(active.autoCompleteAt).getTime() - now) / 1000)
      }
    }
    const activeTotal = active ? active.estimatedDurationMin * 60 : 0
    const activeElapsed = Math.max(0, activeTotal - activeRemaining)

    const completedSeconds = stages
      .filter((s) => s.status === 'completed' || s.status === 'skipped')
      .reduce((acc, s) => acc + s.estimatedDurationMin * 60, 0)

    const elapsedTotal = completedSeconds + activeElapsed
    const remainingTotal = Math.max(0, totalSeconds - elapsedTotal)
    const percent =
      totalSeconds > 0 ? Math.min(100, Math.max(0, (elapsedTotal / totalSeconds) * 100)) : 0

    const stageIndex = active
      ? stages.findIndex((s) => s.id === active.id) + 1
      : stages.filter((s) => s.status === 'completed' || s.status === 'skipped').length

    const label = paused ? 'Paused' : active ? `Stage ${stageIndex} of ${stages.length}` : 'Idle'

    return (
      <Layout
        leftLabel={active ? (paused ? 'Stage paused' : 'Stage remaining') : 'Total time'}
        leftValue={active ? fmt(activeRemaining) : fmt(totalSeconds)}
        rightLabel="Job remaining"
        rightValue={fmt(remainingTotal)}
        percent={percent}
        footerLeft={label}
        indeterminate={false}
      />
    )
  }

  // --- no-stages fallback: use job-level fields ---
  const totalSeconds =
    estimatedDurationMin != null
      ? estimatedDurationMin * 60
      : autoCompleteAt && startedAt
        ? Math.max(
            0,
            (new Date(autoCompleteAt).getTime() - new Date(startedAt).getTime()) / 1000
          )
        : 0

  const realElapsed = startedAt
    ? Math.max(0, (now - new Date(startedAt).getTime()) / 1000)
    : 0

  let remainingTotal = 0
  let overdue = false
  if (paused && remainingSeconds !== null) {
    remainingTotal = Math.max(0, remainingSeconds)
  } else if (autoCompleteAt) {
    const rawRemaining = (new Date(autoCompleteAt).getTime() - now) / 1000
    remainingTotal = Math.max(0, rawRemaining)
    if (rawRemaining <= 0) overdue = true
  } else if (totalSeconds > 0 && startedAt) {
    const elapsed = realElapsed
    remainingTotal = Math.max(0, totalSeconds - elapsed)
    if (totalSeconds - elapsed <= 0) overdue = true
  }

  const elapsedTotal = totalSeconds > 0 && !overdue ? totalSeconds - remainingTotal : realElapsed

  const percent =
    totalSeconds > 0 ? Math.min(100, Math.max(0, (elapsedTotal / totalSeconds) * 100)) : 0

  const indeterminate = totalSeconds === 0 && !!startedAt
  const label = paused
    ? 'Paused'
    : overdue
      ? 'Awaiting auto-complete'
      : startedAt
        ? 'In progress'
        : 'Not started'

  return (
    <Layout
      leftLabel={paused ? 'Paused' : 'Elapsed'}
      leftValue={fmt(elapsedTotal)}
      rightLabel={
        totalSeconds > 0 ? (overdue ? 'Over by' : 'Remaining') : 'Estimate'
      }
      rightValue={
        totalSeconds > 0
          ? overdue
            ? fmt(realElapsed - totalSeconds)
            : fmt(remainingTotal)
          : '—'
      }
      percent={percent}
      footerLeft={label}
      indeterminate={indeterminate}
    />
  )
}

function Layout({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  percent,
  footerLeft,
  indeterminate,
}: {
  leftLabel: string
  leftValue: string
  rightLabel: string
  rightValue: string
  percent: number
  footerLeft: string
  indeterminate: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-muted-foreground text-xs uppercase tracking-wide">{leftLabel}</div>
          <div className="font-mono text-3xl tabular-nums">{leftValue}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">{rightLabel}</div>
          <div className="font-mono text-xl tabular-nums">{rightValue}</div>
        </div>
      </div>
      <div className="bg-muted relative h-3 w-full overflow-hidden rounded-full">
        {indeterminate ? null : (
          <div
            className="bg-primary h-full transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{footerLeft}</span>
        <span>{indeterminate ? '' : `${percent.toFixed(0)}%`}</span>
      </div>
    </div>
  )
}
