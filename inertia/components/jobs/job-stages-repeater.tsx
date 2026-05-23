import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus, Timer } from 'lucide-react'

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

function humanize(minutes: number): string {
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
    <div className="space-y-3">
      <div>
        <Label>Stages</Label>
        <p className="text-muted-foreground mt-1 text-xs">
          Break the job into stages. Each stage's timer starts when the previous one finishes.
        </p>
      </div>

      <div className="space-y-3">
        {value.map((row, i) => (
          <div key={i} className="bg-muted/30 rounded-md border p-3">
            <div className="flex items-end gap-3">
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
              <div className="w-40">
                <Label htmlFor={`stage-duration-${i}`} className="text-xs">
                  Duration (minutes)
                </Label>
                <div className="relative mt-1">
                  <Timer className="text-muted-foreground pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id={`stage-duration-${i}`}
                    type="number"
                    min={1}
                    step={1}
                    value={row.durationMinutes}
                    onChange={(e) =>
                      update(i, { durationMinutes: Math.max(0, Number(e.target.value) || 0) })
                    }
                    placeholder="e.g. 30"
                    className="pl-8"
                  />
                </div>
              </div>
              {value.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  aria-label="Remove stage"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                = {humanize(row.durationMinutes)}
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
        <Plus className="mr-1 h-4 w-4" /> Add stage
      </Button>
    </div>
  )
}
