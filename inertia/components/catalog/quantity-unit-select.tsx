import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMeasurementUnits } from '@/lib/quantity_units'

export function QuantityUnitSelect({
  stored = 'pcs',
  value,
  onChange,
  label = 'Quantity unit',
}: {
  stored?: string
  value: string
  onChange: (unit: string) => void
  label?: string
}) {
  const { compatibleUnits } = useMeasurementUnits()
  const options = compatibleUnits(stored)
  return (
    <Select
      value={options.includes(value) ? value : stored}
      onValueChange={onChange}
      disabled={!options.length}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder="Unit" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unit}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
