const UNIT_FACTORS: Record<string, { family: string; factor: number }> = {
  mg: { family: 'mass', factor: 1 },
  g: { family: 'mass', factor: 1_000 },
  kg: { family: 'mass', factor: 1_000_000 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1_000 },
  mm: { family: 'length', factor: 1 },
  cm: { family: 'length', factor: 10 },
  m: { family: 'length', factor: 1_000 },
}

export function compatibleUnits(storedUnit: string): string[] {
  const normalized = storedUnit.trim().toLowerCase()
  if (!normalized) return []
  const definition = UNIT_FACTORS[normalized]
  if (!definition) return [storedUnit]
  return Object.entries(UNIT_FACTORS)
    .filter(([, candidate]) => candidate.family === definition.family)
    .map(([unit]) => unit)
}

export function convertDisplayQuantity(value: number, fromUnit: string, toUnit: string): number {
  if (!Number.isFinite(value)) return 0
  const from = UNIT_FACTORS[fromUnit.trim().toLowerCase()]
  const to = UNIT_FACTORS[toUnit.trim().toLowerCase()]
  if (!from || !to || from.family !== to.family) return value
  return (value * from.factor) / to.factor
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number(value.toFixed(9)).toString()
}
