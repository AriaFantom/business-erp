import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'

export interface StageDraft {
  name: string
  durationMinutes: number
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
    <div className="space-y-2">
      <Label>Stages</Label>
      {value.map((row, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Stage name"
            />
          </div>
          <div className="w-32">
            <Input
              type="number"
              min={1}
              value={row.durationMinutes}
              onChange={(e) => update(i, { durationMinutes: Number(e.target.value) || 0 })}
              placeholder="Minutes"
            />
          </div>
          {value.length > 1 ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" /> Add stage
      </Button>
    </div>
  )
}
