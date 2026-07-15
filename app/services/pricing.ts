import env from '#start/env'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { latestProductCost } from '#services/job_costing'
import { DomainError } from '#services/domain_errors'

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
    profitFrom: 'manual' | 'product_default' | 'product' | 'category' | 'global'
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

  // Stored default sale price wins over the formula ladder.
  if (input.product.defaultSalePrice !== null && input.product.defaultSalePrice !== undefined) {
    const stored = Number(input.product.defaultSalePrice)
    return {
      unitPrice: applyRounding(stored, rounding),
      costPrice: input.costPrice,
      profitPctUsed: null,
      taxRatePct: numberOrZero(input.product.taxRatePct ?? input.category?.taxRatePct ?? null),
      basis: {
        profitFrom: 'product_default',
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

export type OrderLineInput = {
  productId?: number | null
  description: string
  qty: number
  unitPrice: number
  taxRatePct: number
}

export type OrderLinePricing = {
  unitPrice: number
  taxRatePct: number
  overridden: boolean
  costPrice: number | null
}

/** Tolerance for treating a client-echoed price as "the suggested price". */
const PRICE_MATCH_TOLERANCE = 0.005

/**
 * Server-side price enforcement for order lines (POS + manual orders).
 *
 * The suggested price and tax rate are always derived on the server; the
 * client-supplied price only matters when it deviates from the suggestion,
 * in which case it is an override that requires `allowOverride` and can
 * never go below the cost basis.
 */
export async function resolveOrderLinePricing(opts: {
  productId: number
  requestedUnitPrice?: number | null
  allowOverride: boolean
}): Promise<OrderLinePricing> {
  const product = await Product.findOrFail(opts.productId)
  const category = product.categoryId ? await ProductCategory.find(product.categoryId) : null
  const cost = await latestProductCost(opts.productId)
  const breakdown = computeUnitPrice({
    costPrice: cost,
    product,
    category,
  })

  const requested = opts.requestedUnitPrice
  const matchesSuggestion =
    requested === null ||
    requested === undefined ||
    Math.abs(requested - breakdown.unitPrice) < PRICE_MATCH_TOLERANCE

  if (matchesSuggestion) {
    return {
      unitPrice: breakdown.unitPrice,
      taxRatePct: breakdown.taxRatePct,
      overridden: false,
      costPrice: breakdown.costPrice,
    }
  }

  if (!opts.allowOverride) {
    throw new DomainError({
      code: 'PRICE_OVERRIDE_FORBIDDEN',
      field: 'unitPrice',
      message: `You are not allowed to override the price of "${product.name}" (suggested ${breakdown.unitPrice.toFixed(2)}).`,
    })
  }

  const costFloor = breakdown.costPrice ?? 0
  if (requested < costFloor) {
    throw new DomainError({
      code: 'PRICE_BELOW_COST',
      field: 'unitPrice',
      message: `Unit price for "${product.name}" cannot go below its cost basis (${costFloor.toFixed(2)}).`,
    })
  }

  return {
    unitPrice: applyRounding(requested, 'none'),
    taxRatePct: breakdown.taxRatePct,
    overridden: true,
    costPrice: breakdown.costPrice,
  }
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
