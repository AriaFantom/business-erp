import env from '#start/env'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { latestProductCost } from '#services/job_costing'

export type RoundingRule = 'nearest_50_paise' | 'nearest_rupee' | 'none'

const DEFAULT_ROUNDING: RoundingRule = 'nearest_50_paise'

function defaultProfitPctFallback(): number {
  const raw = env.get('PRICING_DEFAULT_PROFIT_PCT', '30')
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 30
}

function applyRounding(price: number, rule: RoundingRule): number {
  switch (rule) {
    case 'nearest_rupee':
      return Math.round(price)
    case 'nearest_50_paise':
      return Math.round(price * 2) / 2
    case 'none':
    default:
      return Math.round(price * 100) / 100
  }
}

export type PriceBreakdown = {
  /** Resolved unit price after profit + rounding. */
  unitPrice: number
  /** Cost basis used (latest finished unit cost). null when no completed jobs exist. */
  costPrice: number | null
  /** Profit pct that won the layered-default lookup. */
  profitPctUsed: number | null
  /** Tax pct that won the layered-default lookup. */
  taxRatePct: number
  /** Provenance for the fields above. */
  basis: {
    profitFrom: 'manual' | 'product' | 'category' | 'global'
    taxFrom: 'product' | 'category' | 'global'
    rounding: RoundingRule
  }
}

/**
 * Pure pricing function. No DB writes. Used by quotation creation and the
 * "suggest price" endpoint. Layered defaults: manual override > product >
 * category > global env.
 *
 * If `costPrice` is null (no completed job yet for the product), the unit
 * price is computed against 0 — caller can detect this and either reject
 * or surface a warning.
 */
export function computeUnitPrice(input: {
  costPrice: number | null
  manualUnitPrice?: number | null
  product: Product
  category: ProductCategory | null
  rounding?: RoundingRule
}): PriceBreakdown {
  const rounding = input.rounding ?? DEFAULT_ROUNDING

  // Manual override skips the profit ladder entirely.
  if (input.manualUnitPrice !== null && input.manualUnitPrice !== undefined) {
    return {
      unitPrice: applyRounding(input.manualUnitPrice, rounding),
      costPrice: input.costPrice,
      profitPctUsed: null,
      taxRatePct: numberOrZero(input.product.taxRatePct ?? input.category?.taxRatePct ?? null),
      basis: {
        profitFrom: 'manual',
        taxFrom: pickTaxBasis(input.product, input.category),
        rounding,
      },
    }
  }

  // Layered profit lookup.
  let profitPct: number
  let profitFrom: 'product' | 'category' | 'global'
  if (input.product.defaultProfitPct !== null) {
    profitPct = Number(input.product.defaultProfitPct)
    profitFrom = 'product'
  } else if (input.category?.defaultProfitPct) {
    profitPct = Number(input.category.defaultProfitPct)
    profitFrom = 'category'
  } else {
    profitPct = defaultProfitPctFallback()
    profitFrom = 'global'
  }

  const cost = input.costPrice ?? 0
  const raw = cost * (1 + profitPct / 100)
  const unitPrice = applyRounding(raw, rounding)

  return {
    unitPrice,
    costPrice: input.costPrice,
    profitPctUsed: profitPct,
    taxRatePct: numberOrZero(input.product.taxRatePct ?? input.category?.taxRatePct ?? null),
    basis: {
      profitFrom,
      taxFrom: pickTaxBasis(input.product, input.category),
      rounding,
    },
  }
}

function pickTaxBasis(
  product: Product,
  category: ProductCategory | null
): 'product' | 'category' | 'global' {
  if (product.taxRatePct !== null) return 'product'
  if (category?.taxRatePct) return 'category'
  return 'global'
}

function numberOrZero(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Convenience: load product + category + cost and compute a suggestion in
 * one call. Used by the "suggest price" endpoint.
 */
export async function suggestPriceFor(productId: number): Promise<PriceBreakdown> {
  const product = await Product.findOrFail(productId)
  const category = product.categoryId ? await ProductCategory.find(product.categoryId) : null
  const cost = await latestProductCost(productId)
  return computeUnitPrice({
    costPrice: cost,
    product,
    category,
  })
}
