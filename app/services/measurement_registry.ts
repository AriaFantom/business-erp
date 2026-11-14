import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import { audit } from '#services/audit'
import { DomainError } from '#services/domain_errors'
import { convertConsumptionQuantity } from '#services/quantity_units'

export type MeasurementUnit = {
  id: number
  categoryId: number
  category: string
  code: string
  name: string
  factor: string
  reference: boolean
  active: boolean
  locked: boolean
}

export async function getMeasurementUnits(trx?: TransactionClientContract) {
  return (trx ?? db)
    .from('measurement_units as unit')
    .join('measurement_categories as category', 'category.id', 'unit.category_id')
    .select(
      'unit.id',
      'unit.code',
      'unit.name',
      'unit.factor',
      'unit.category_id as categoryId',
      'category.name as category',
      'unit.is_reference as reference',
      'unit.is_active as active',
      'unit.is_locked as locked'
    )
    .orderBy('category.name')
    .orderBy('unit.is_reference', 'desc')
    .orderBy('unit.code') as unknown as Promise<MeasurementUnit[]>
}

export async function measurementIndex(trx?: TransactionClientContract) {
  const units = await getMeasurementUnits(trx)
  return new Map(units.map((unit) => [unit.code, unit]))
}

export async function normalizeOutputCount(
  trx: TransactionClientContract,
  quantity: number,
  unit?: string
) {
  await lockMeasurementRegistry(trx)
  const registry = await measurementIndex(trx)
  const snapshot = convertConsumptionQuantity(quantity, unit, 'pcs', registry, {
    wholePieces: true,
    allowZero: true,
  })
  const pieces = Number(snapshot.storedQuantity)
  if (pieces > 1_000_000) {
    throw new DomainError({
      code: 'OUTPUT_COUNT_LIMIT',
      message: 'Enter at most 1,000,000 pieces.',
    })
  }
  await markMeasurementUnitsUsed(trx, [snapshot.enteredUnit])
  return {
    pieces,
    snapshot: { ...snapshot, factor: registry.get(snapshot.enteredUnit)?.factor ?? '1' },
  }
}

export type SalesUnitSnapshot = {
  unit: string
  quantity: string
  factor: string
  unitPrice: string
}

export function normalizeSalesCount(
  registry: Awaited<ReturnType<typeof measurementIndex>>,
  quantity: number,
  unit?: string
) {
  const conversion = convertConsumptionQuantity(quantity, unit, 'pcs', registry, {
    wholePieces: true,
  })
  const pieces = Number(conversion.storedQuantity)
  if (pieces > 1_000_000)
    throw new DomainError({
      code: 'OUTPUT_COUNT_LIMIT',
      message: 'Enter at most 1,000,000 pieces.',
    })
  const factor = registry.get(conversion.enteredUnit)?.factor ?? '1'
  return {
    pieces,
    factor: Number(factor),
    snapshot: (unitPrice: number): SalesUnitSnapshot | null =>
      unit
        ? {
            unit: conversion.enteredUnit,
            quantity: conversion.enteredQuantity,
            factor,
            unitPrice: String(unitPrice),
          }
        : null,
  }
}

export async function getStoredUnits(
  trx: TransactionClientContract,
  items: { itemKind: string; itemId: number }[]
) {
  const result = new Map<string, string>()
  for (const kind of ['material', 'component'] as const) {
    const ids = [
      ...new Set(items.filter((item) => item.itemKind === kind).map((item) => item.itemId)),
    ]
    if (!ids.length) continue
    const rows = await trx
      .from(kind === 'material' ? 'materials' : 'components')
      .whereIn('id', ids)
      .orderBy('id')
      .forShare()
      .select('id', 'unit')
    for (const row of rows) result.set(`${kind}:${row.id}`, row.unit)
  }
  for (const item of items)
    if (item.itemKind === 'product' || item.itemKind === 'machine') {
      result.set(`${item.itemKind}:${item.itemId}`, 'pcs')
    }
  return result
}

// Writers take an exclusive lock; business transactions share the lock while
// resolving and marking units used, so an edit cannot race first use.
export async function lockMeasurementRegistry(trx: TransactionClientContract, write = false) {
  await trx.rawQuery(
    write
      ? 'select pg_advisory_xact_lock(41750, 1)'
      : 'select pg_advisory_xact_lock_shared(41750, 1)'
  )
}

export async function markMeasurementUnitsUsed(trx: TransactionClientContract, codes: string[]) {
  if (codes.length)
    await trx
      .from('measurement_units')
      .whereIn('code', [...new Set(codes.map((code) => code.trim().toLowerCase()))])
      .where('is_locked', false)
      .update({ is_locked: true })
}

type UnitInput = {
  name: string
  code: string
  factor: string
  categoryId?: number
  categoryName?: string
}

export async function createMeasurementUnit(actor: User, input: UnitInput) {
  return db.transaction(async (trx) => {
    await lockMeasurementRegistry(trx, true)
    if (await trx.from('measurement_units').where('code', input.code).first()) {
      throw new DomainError({ code: 'UNIT_EXISTS', message: 'This unit code is already in use.' })
    }
    let categoryId = input.categoryId
    const reference = input.categoryName !== undefined
    if (input.categoryName !== undefined) {
      if (categoryId || Number(input.factor) !== 1) {
        throw new DomainError({
          code: 'INVALID_REFERENCE_UNIT',
          message: 'A new category needs one reference unit with factor 1.',
        })
      }
      if (
        await trx
          .from('measurement_categories')
          .whereRaw('lower(name) = lower(?)', [input.categoryName])
          .first()
      ) {
        throw new DomainError({ code: 'CATEGORY_EXISTS', message: 'This category already exists.' })
      }
      const [category] = await trx
        .table('measurement_categories')
        .insert({ name: input.categoryName })
        .returning('id')
      categoryId = category.id
    } else if (
      !categoryId ||
      !(await trx.from('measurement_categories').where('id', categoryId).first())
    ) {
      throw new DomainError({
        code: 'CATEGORY_REQUIRED',
        message: 'Choose an existing unit category.',
      })
    }
    const [unit] = await trx
      .table('measurement_units')
      .insert({
        category_id: categoryId,
        name: input.name,
        code: input.code,
        factor: input.factor,
        is_reference: reference,
        is_locked: reference,
      })
      .returning('id')
    await audit({
      actor,
      action: 'measurement_unit.create',
      targetType: 'measurement_unit',
      targetId: unit.id,
      payload: { ...input, categoryId },
      trx,
    })
  })
}

export async function updateMeasurementUnit(
  actor: User,
  id: number,
  input: { name: string; active: boolean; factor?: string }
) {
  return db.transaction(async (trx) => {
    await lockMeasurementRegistry(trx, true)
    const unit = await trx.from('measurement_units').where('id', id).forUpdate().first()
    if (!unit)
      throw new DomainError({ code: 'UNIT_NOT_FOUND', message: 'This unit no longer exists.' })
    if ((unit.is_reference && !input.active) || (unit.is_locked && input.factor !== undefined)) {
      throw new DomainError({
        code: 'UNIT_LOCKED',
        message: 'This conversion is locked. Add a new unit to correct it.',
      })
    }
    await trx
      .from('measurement_units')
      .where('id', id)
      .update({
        name: input.name,
        is_active: input.active,
        ...(input.factor === undefined ? {} : { factor: input.factor }),
      })
    await audit({
      actor,
      action: 'measurement_unit.update',
      targetType: 'measurement_unit',
      targetId: id,
      payload: input,
      trx,
    })
  })
}
