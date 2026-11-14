import { createHash } from 'node:crypto'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { measurementIndex } from '#services/measurement_registry'
import env from '#start/env'
import Material from '#models/material'
import Component from '#models/component'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { DomainError } from '#services/domain_errors'
import {
  addQuantities,
  compareQuantities,
  convertConsumptionQuantity,
} from '#services/quantity_units'

export type QuotationEstimateInput = {
  productId?: number | null
  extraCost: number
  profitPct?: number | null
  boms: Array<{
    itemKind: 'material' | 'component'
    itemId: number
    qty: number
    unit?: string
  }>
}

export type QuotationEstimate = {
  materialCost: number
  componentCost: number
  catalogCost: number
  extraCost: number
  estimatedUnitCost: number
  profitPct: number
  profitFrom: 'category' | 'product' | 'global'
  suggestedUnitPrice: number
  fingerprint: string
  boms: Array<{
    itemKind: 'material' | 'component'
    itemId: number
    name: string
    unit: string
    qty: number
    unitCost: number
    lineCost: number
    zeroCost: boolean
  }>
}

const MAX_MONEY = 9_999_999_999.9999

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

function roundUpCent(value: number) {
  return Math.ceil((value - Number.EPSILON) * 100) / 100
}

function globalProfitPct() {
  const value = Number(env.get('PRICING_DEFAULT_PROFIT_PCT', '30'))
  return Number.isFinite(value) && value >= 0 ? value : 30
}

function validateNumber(value: number, label: string, max: number, decimals: number) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new DomainError({
      code: 'INVALID_ESTIMATE',
      message: `${label} is outside the supported range.`,
    })
  }
  const scaled = value * 10 ** decimals
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    throw new DomainError({
      code: 'INVALID_ESTIMATE_PRECISION',
      message: `${label} supports at most ${decimals} decimal places.`,
    })
  }
}

async function resolveProfit(productId?: number | null) {
  const product = productId
    ? await Product.query().where('id', productId).preload('category').firstOrFail()
    : null
  const category = product
    ? product.category
    : await ProductCategory.query().where('name', 'Custom Orders').first()

  if (category?.defaultProfitPct !== null && category?.defaultProfitPct !== undefined) {
    return { profitPct: Number(category.defaultProfitPct), profitFrom: 'category' as const }
  }
  if (product?.defaultProfitPct !== null && product?.defaultProfitPct !== undefined) {
    return { profitPct: Number(product.defaultProfitPct), profitFrom: 'product' as const }
  }
  return { profitPct: globalProfitPct(), profitFrom: 'global' as const }
}

export async function estimateQuotationLine(
  input: QuotationEstimateInput,
  units?: Awaited<ReturnType<typeof measurementIndex>>,
  trx?: TransactionClientContract
): Promise<QuotationEstimate> {
  const registry = units ?? (await measurementIndex(trx))
  validateNumber(input.extraCost, 'Extra cost', MAX_MONEY, 4)
  if (input.profitPct !== null && input.profitPct !== undefined) {
    validateNumber(input.profitPct, 'Markup', 1000, 2)
  }

  const materialIds = input.boms.filter((b) => b.itemKind === 'material').map((b) => b.itemId)
  const componentIds = input.boms.filter((b) => b.itemKind === 'component').map((b) => b.itemId)
  const [materials, components, resolvedProfit] = await Promise.all([
    materialIds.length
      ? Material.query({ client: trx })
          .whereIn('id', materialIds)
          .where('is_active', true)
          .if(trx, (query) => query.forShare())
      : [],
    componentIds.length
      ? Component.query({ client: trx })
          .whereIn('id', componentIds)
          .where('is_active', true)
          .if(trx, (query) => query.forShare())
      : [],
    resolveProfit(input.productId),
  ])
  const materialById = new Map(materials.map((item) => [item.id, item]))
  const componentById = new Map(components.map((item) => [item.id, item]))

  const merged = new Map<
    string,
    { itemKind: 'material' | 'component'; itemId: number; qty: string }
  >()
  const definitions = []
  for (const bom of input.boms) {
    const item =
      bom.itemKind === 'material' ? materialById.get(bom.itemId) : componentById.get(bom.itemId)
    if (!item) {
      throw new DomainError({
        code: 'ESTIMATE_ITEM_UNAVAILABLE',
        message: `A selected ${bom.itemKind} is no longer available. Review the estimate.`,
      })
    }
    const converted = convertConsumptionQuantity(bom.qty, bom.unit, item.unit, registry)
    const source = registry.get(converted.enteredUnit)
    const destination = registry.get(item.unit.trim().toLowerCase())
    definitions.push([source?.id, source?.factor, destination?.id, destination?.factor])
    const key = `${bom.itemKind}:${bom.itemId}`
    const current = merged.get(key)
    const qty = current
      ? addQuantities(current.qty, converted.storedQuantity)
      : converted.storedQuantity
    if (compareQuantities(qty, 1_000_000) > 0) {
      throw new DomainError({
        code: 'INVALID_ESTIMATE',
        message: `Item quantity exceeds 1,000,000 ${item.unit}.`,
      })
    }
    merged.set(key, { itemKind: bom.itemKind, itemId: bom.itemId, qty })
  }

  const normalized = [...merged.values()]

  let materialCost = 0
  let componentCost = 0
  const boms = normalized.map((bom) => {
    const item =
      bom.itemKind === 'material' ? materialById.get(bom.itemId) : componentById.get(bom.itemId)
    if (!item) {
      throw new DomainError({
        code: 'ESTIMATE_ITEM_UNAVAILABLE',
        message: `A selected ${bom.itemKind} is no longer available. Review the estimate.`,
      })
    }
    const unitCost = Number(item.defaultUnitCost)
    const normalizedQty = Number(bom.qty)
    const lineCost = round4(normalizedQty * unitCost)
    if (bom.itemKind === 'material') materialCost += lineCost
    else componentCost += lineCost
    return {
      itemKind: bom.itemKind,
      itemId: bom.itemId,
      name: item.name,
      unit: item.unit,
      qty: normalizedQty,
      unitCost,
      lineCost,
      zeroCost: unitCost === 0,
    }
  })

  materialCost = round4(materialCost)
  componentCost = round4(componentCost)
  const catalogCost = round4(materialCost + componentCost)
  const estimatedUnitCost = round4(catalogCost + input.extraCost)
  if (estimatedUnitCost > MAX_MONEY) {
    throw new DomainError({
      code: 'ESTIMATE_OVERFLOW',
      message: 'The estimated cost is too large.',
    })
  }
  const profitPct = input.profitPct ?? resolvedProfit.profitPct
  const suggestedUnitPrice = roundUpCent(estimatedUnitCost * (1 + profitPct / 100))
  if (suggestedUnitPrice > MAX_MONEY) {
    throw new DomainError({
      code: 'ESTIMATE_OVERFLOW',
      message: 'The suggested price is too large.',
    })
  }
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify(
        boms.map((bom, index) => [bom.itemKind, bom.itemId, normalized[index].qty, bom.unitCost])
      )
    )
    .update(JSON.stringify(definitions))
    .digest('hex')

  return {
    materialCost,
    componentCost,
    catalogCost,
    extraCost: round4(input.extraCost),
    estimatedUnitCost,
    profitPct,
    profitFrom: resolvedProfit.profitFrom,
    suggestedUnitPrice,
    fingerprint,
    boms,
  }
}
