import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMeasurementUnits } from '@/lib/quantity_units'

type Props = { value: string; onChange: (v: string) => void; placeholder?: string }

export function UnitPicker({ value, onChange, placeholder }: Props) {
  const { units } = useMeasurementUnits()
  const categories = new Map<string, typeof units>()
  for (const unit of units) {
    if (!unit.active) continue
    const group = categories.get(unit.category) ?? []
    group.push(unit)
    categories.set(unit.category, group)
  }
  const selected = value.trim().toLowerCase()
  return (
    <Select value={selected} onValueChange={onChange}>
      <SelectTrigger aria-label="Unit of measure" className="w-full min-w-0">
        <SelectValue placeholder={placeholder ?? 'Pick a unit'} />
      </SelectTrigger>
      <SelectContent>
        {selected && !units.some((unit) => unit.code === selected && unit.active) && (
          <SelectGroup>
            <SelectItem disabled value={selected}>
              {value} (not available)
            </SelectItem>
          </SelectGroup>
        )}
        {[...categories].map(([category, group]) => (
          <SelectGroup key={category}>
            <SelectLabel>{category}</SelectLabel>
            {group.map((unit) => (
              <SelectItem key={unit.code} value={unit.code}>
                {unit.code} ({unit.name})
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
