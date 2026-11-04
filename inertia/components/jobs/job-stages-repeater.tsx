import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'

export interface StageDraft {
  name: string
  durationMinutes: number
}

const PRESETS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hrs', minutes: 120 },
  { label: '4 hrs', minutes: 240 },
]

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h} hr ${m} min`
  if (h) return `${h} hr`
  return `${m} min`
}

export function JobStagesRepeater({
  value,
  onChange,
}: {
  value: StageDraft[]
  onChange: (next: StageDraft[]) => void
}) {
  const update = (i: number, patch: Partial<StageDraft>) => {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const add = () => onChange([...value, { name: `Stage ${value.length + 1}`, durationMinutes: 30 }])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label>Stages</Label>
        <p className="text-muted-foreground mt-1 text-xs">
          Break the job into stages. Each stage's timer starts when the previous one finishes.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {value.map((row, i) => (
          <div key={i} className="bg-muted/30 rounded-md border p-3">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
              <div className="flex-1">
                <Label htmlFor={`stage-name-${i}`} className="text-xs">
                  Stage {i + 1} name
                </Label>
                <Input
                  id={`stage-name-${i}`}
                  value={row.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder={`Stage ${i + 1}`}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`stage-hours-${i}`} className="text-xs">
                  Hours
                </Label>
                <Input
                  id={`stage-hours-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={336}
                  step={1}
                  value={Math.floor(row.durationMinutes / 60)}
                  onChange={(e) => {
                    const hours = Math.min(
                      336,
                      Math.max(0, Math.trunc(Number(e.target.value) || 0))
                    )
                    update(i, {
                      durationMinutes: hours * 60 + (hours === 336 ? 0 : row.durationMinutes % 60),
                    })
                  }}
                />
              </div>
              <div>
                <Label htmlFor={`stage-minutes-${i}`} className="text-xs">
                  Minutes
                </Label>
                <Input
                  id={`stage-minutes-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  step={1}
                  value={row.durationMinutes % 60}
                  onChange={(e) => {
                    const hours = Math.floor(row.durationMinutes / 60)
                    const minutes =
                      hours === 336
                        ? 0
                        : Math.min(59, Math.max(0, Math.trunc(Number(e.target.value) || 0)))
                    update(i, {
                      durationMinutes: Math.floor(row.durationMinutes / 60) * 60 + minutes,
                    })
                  }}
                />
              </div>
              {value.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  aria-label="Remove stage"
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Total: {formatDuration(row.durationMinutes)}
              </span>
              <span className="text-muted-foreground/60 text-xs">·</span>
              {PRESETS.map((p) => (
                <Button
                  key={p.minutes}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => update(i, { durationMinutes: p.minutes })}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus data-icon="inline-start" /> Add stage
      </Button>
    </div>
  )
}
