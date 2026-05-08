import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const PRESETS = ['pcs', 'g', 'kg', 'mg', 'ml', 'l', 'm', 'cm', 'mm']
const CUSTOM = '__custom__'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function UnitPicker({ value, onChange, placeholder }: Props) {
  const isPreset = PRESETS.includes(value) || value === ''
  const [custom, setCustom] = useState(isPreset)

  if (!custom) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={value}
          maxLength={16}
          placeholder="e.g. roll, sheet, ft"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline"
          onClick={() => {
            setCustom(true)
            onChange('')
          }}
        >
          Use preset
        </button>
      </div>
    )
  }

  return (
    <Select
      value={PRESETS.includes(value) ? value : ''}
      onValueChange={(v) => {
        if (v === CUSTOM) {
          setCustom(false)
          onChange('')
        } else {
          onChange(v)
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? 'Pick a unit'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pcs">pcs (pieces)</SelectItem>
        <SelectItem value="g">g (grams)</SelectItem>
        <SelectItem value="kg">kg (kilograms)</SelectItem>
        <SelectItem value="mg">mg (milligrams)</SelectItem>
        <SelectItem value="ml">ml (millilitres)</SelectItem>
        <SelectItem value="l">l (litres)</SelectItem>
        <SelectItem value="m">m (metres)</SelectItem>
        <SelectItem value="cm">cm (centimetres)</SelectItem>
        <SelectItem value="mm">mm (millimetres)</SelectItem>
        <SelectItem value={CUSTOM}>Custom…</SelectItem>
      </SelectContent>
    </Select>
  )
}
