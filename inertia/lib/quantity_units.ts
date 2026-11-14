import { usePage } from '@inertiajs/react'
import { useMemo } from 'react'

type Unit = {
  categoryId: number
  code: string
  name: string
  factor: string
  active: boolean
  category: string
}
const key = (unit: string) => unit.trim().toLowerCase()

export function useMeasurementUnits() {
  const { measurementUnits } = usePage<{ measurementUnits?: Unit[] }>().props
  return useMemo(() => {
    const units = measurementUnits ?? []
    const index = new Map(units.map((unit) => [unit.code, unit]))
    return {
      units,
      compatibleUnits(stored: string) {
        if (!key(stored)) return []
        const definition = index.get(key(stored))
        if (!definition) return [stored]
        return [
          stored,
          ...units
            .filter(
              (unit) =>
                unit.active &&
                unit.categoryId === definition.categoryId &&
                unit.code !== key(stored)
            )
            .map((unit) => unit.code),
        ]
      },
      convertDisplayQuantity(value: number, fromUnit: string, toUnit: string) {
        if (!Number.isFinite(value)) return 0
        const from = index.get(key(fromUnit))
        const to = index.get(key(toUnit))
        if (!from || !to || from.categoryId !== to.categoryId) return value
        return (value * Number(from.factor)) / Number(to.factor)
      },
    }
  }, [measurementUnits])
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number(value.toFixed(9)).toString()
}
