import { useEffect, useState } from 'react'

interface Props {
  autoCompleteAt: string | null
  remainingSeconds: number | null
  paused: boolean
  serverNow?: string
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function JobCountdown({ autoCompleteAt, remainingSeconds, paused, serverNow }: Props) {
  const [skewMs] = useState(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0))
  const [clientNow, setClientNow] = useState(() => Date.now())
  const now = clientNow + skewMs

  useEffect(() => {
    if (paused || !autoCompleteAt) return
    const id = setInterval(() => setClientNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused, autoCompleteAt])

  if (paused && remainingSeconds !== null) {
    return <span className="font-mono">Paused — {fmt(remainingSeconds)} left</span>
  }
  if (!autoCompleteAt) {
    return <span className="text-muted-foreground">—</span>
  }
  const remaining = (new Date(autoCompleteAt).getTime() - now) / 1000
  if (remaining <= 0) {
    return <span className="font-mono text-amber-600">Awaiting confirmation</span>
  }
  return <span className="font-mono">{fmt(remaining)}</span>
}
