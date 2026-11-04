import { DomainError } from '#services/domain_errors'

export const QUANTITY_SCALE = 9
const SCALE_FACTOR = 1_000_000_000n
const MAX_SCALED_QUANTITY = 99_999_999_999_999_999_999n

const UNIT_FACTORS = {
  mg: { family: 'mass', factor: 1n },
  g: { family: 'mass', factor: 1_000n },
  kg: { family: 'mass', factor: 1_000_000n },
  ml: { family: 'volume', factor: 1n },
  l: { family: 'volume', factor: 1_000n },
  mm: { family: 'length', factor: 1n },
  cm: { family: 'length', factor: 10n },
  m: { family: 'length', factor: 1_000n },
} as const

type KnownUnit = keyof typeof UNIT_FACTORS

function expandScientific(value: string): string {
  if (!/[eE]/.test(value)) return value
  const match = value.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/)
  if (!match) return value
  const [, sign, integer, fraction = '', exponentText] = match
  const digits = integer + fraction
  const decimalAt = integer.length + Number(exponentText)
  if (decimalAt <= 0) return `${sign}0.${'0'.repeat(-decimalAt)}${digits}`
  if (decimalAt >= digits.length) return `${sign}${digits}${'0'.repeat(decimalAt - digits.length)}`
  return `${sign}${digits.slice(0, decimalAt)}.${digits.slice(decimalAt)}`
}

export function quantityToScaled(value: number | string): bigint {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new DomainError({
      code: 'INVALID_QUANTITY',
      message: 'Quantity must be a finite number.',
    })
  }
  const normalized = expandScientific(String(value).trim())
  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d+))?$/)
  if (!match) {
    throw new DomainError({ code: 'INVALID_QUANTITY', message: 'Quantity must be a valid number.' })
  }
  const [, sign, integerText, fractionText = ''] = match
  if (fractionText.length > QUANTITY_SCALE) {
    throw new DomainError({
      code: 'QUANTITY_PRECISION',
      message: `Quantity may have at most ${QUANTITY_SCALE} decimal places.`,
    })
  }
  const scaled =
    BigInt(integerText) * SCALE_FACTOR + BigInt(fractionText.padEnd(QUANTITY_SCALE, '0') || '0')
  const signed = sign === '-' ? -scaled : scaled
  if (signed > MAX_SCALED_QUANTITY || signed < -MAX_SCALED_QUANTITY) {
    throw new DomainError({
      code: 'QUANTITY_TOO_LARGE',
      message: 'Quantity exceeds the supported database limit.',
    })
  }
  return signed
}

export function scaledToQuantity(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  const integer = absolute / SCALE_FACTOR
  const fraction = String(absolute % SCALE_FACTOR)
    .padStart(QUANTITY_SCALE, '0')
    .replace(/0+$/, '')
  return `${sign}${integer}${fraction ? `.${fraction}` : ''}`
}

export function addQuantities(left: number | string, right: number | string): string {
  return scaledToQuantity(quantityToScaled(left) + quantityToScaled(right))
}

export function subtractQuantities(left: number | string, right: number | string): string {
  return scaledToQuantity(quantityToScaled(left) - quantityToScaled(right))
}

export function compareQuantities(left: number | string, right: number | string): number {
  const a = quantityToScaled(left)
  const b = quantityToScaled(right)
  return a < b ? -1 : a > b ? 1 : 0
}

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase()
}

export function compatibleConsumptionUnits(storedUnit: string): string[] {
  const normalized = normalizeUnit(storedUnit)
  const definition = UNIT_FACTORS[normalized as KnownUnit]
  if (!definition) return [storedUnit]
  return Object.entries(UNIT_FACTORS)
    .filter(([, candidate]) => candidate.family === definition.family)
    .map(([unit]) => unit)
}

export function convertConsumptionQuantity(
  value: number | string,
  enteredUnit: string | undefined,
  storedUnit: string
): { enteredQuantity: string; enteredUnit: string; storedQuantity: string; storedUnit: string } {
  const enteredQuantity = scaledToQuantity(quantityToScaled(value))
  const sourceUnit = (enteredUnit?.trim() || storedUnit).toLowerCase()
  const destinationUnit = normalizeUnit(storedUnit)
  const source = UNIT_FACTORS[sourceUnit as KnownUnit]
  const destination = UNIT_FACTORS[destinationUnit as KnownUnit]

  let storedScaled: bigint
  if (!source || !destination) {
    if (sourceUnit !== destinationUnit) {
      throw new DomainError({
        code: 'INCOMPATIBLE_UNIT',
        field: 'unit',
        message: `Unit "${enteredUnit}" is not compatible with the stored unit "${storedUnit}".`,
      })
    }
    storedScaled = quantityToScaled(value)
  } else {
    if (source.family !== destination.family) {
      throw new DomainError({
        code: 'INCOMPATIBLE_UNIT',
        field: 'unit',
        message: `Unit "${enteredUnit}" is not compatible with the stored unit "${storedUnit}".`,
      })
    }
    const numerator = quantityToScaled(value) * source.factor
    if (numerator % destination.factor !== 0n) {
      throw new DomainError({
        code: 'QUANTITY_PRECISION',
        field: 'qtyConsumed',
        message: `That conversion is smaller than ${QUANTITY_SCALE} decimal places in ${storedUnit}.`,
      })
    }
    storedScaled = numerator / destination.factor
  }

  if (storedScaled <= 0n) {
    throw new DomainError({
      code: 'INVALID_QUANTITY',
      field: 'qtyConsumed',
      message: 'Consumed quantity must be greater than zero.',
    })
  }
  if (storedScaled > MAX_SCALED_QUANTITY) {
    throw new DomainError({
      code: 'QUANTITY_TOO_LARGE',
      field: 'qtyConsumed',
      message: 'Converted quantity exceeds the supported database limit.',
    })
  }

  return {
    enteredQuantity,
    enteredUnit: sourceUnit,
    storedQuantity: scaledToQuantity(storedScaled),
    storedUnit,
  }
}
