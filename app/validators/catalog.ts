import vine from '@vinejs/vine'

const skuRule = vine
  .string()
  .trim()
  .minLength(1)
  .maxLength(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)

const nameRule = vine.string().trim().minLength(1).maxLength(120)
const moneyRule = vine.number().min(0).max(99_999_999_999)
const decimalQtyRule = vine.number().min(0)
const percentRule = vine.number().min(0).max(100)

// ── Suppliers ───────────────────────────────────────────────────────────
export const createSupplierValidator = vine.compile(
  vine.object({
    name: nameRule,
    gstin: vine.string().trim().maxLength(32).optional(),
    email: vine.string().trim().email().maxLength(160).optional(),
    phone: vine.string().trim().maxLength(40).optional(),
    address: vine.string().trim().maxLength(500).optional(),
  })
)

export const updateSupplierValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    gstin: vine.string().trim().maxLength(32).nullable().optional(),
    email: vine.string().trim().email().maxLength(160).nullable().optional(),
    phone: vine.string().trim().maxLength(40).nullable().optional(),
    address: vine.string().trim().maxLength(500).nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

// ── Customers ───────────────────────────────────────────────────────────
export const createCustomerValidator = vine.compile(
  vine.object({
    name: nameRule,
    gstin: vine.string().trim().maxLength(32).optional(),
    email: vine.string().trim().email().maxLength(160).optional(),
    phone: vine.string().trim().maxLength(40).optional(),
    billingAddress: vine.string().trim().maxLength(500).optional(),
    shippingAddress: vine.string().trim().maxLength(500).optional(),
  })
)

export const updateCustomerValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    gstin: vine.string().trim().maxLength(32).nullable().optional(),
    email: vine.string().trim().email().maxLength(160).nullable().optional(),
    phone: vine.string().trim().maxLength(40).nullable().optional(),
    billingAddress: vine.string().trim().maxLength(500).nullable().optional(),
    shippingAddress: vine.string().trim().maxLength(500).nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

// ── Materials ───────────────────────────────────────────────────────────
export const createMaterialValidator = vine.compile(
  vine.object({
    sku: skuRule,
    name: nameRule,
    type: vine.enum(['filament', 'resin', 'other']),
    defaultSupplierId: vine.number().positive().optional(),
    defaultUnitCost: moneyRule,
    reorderThresholdG: decimalQtyRule.optional(),
  })
)

export const updateMaterialValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    type: vine.enum(['filament', 'resin', 'other']).optional(),
    defaultSupplierId: vine.number().positive().nullable().optional(),
    defaultUnitCost: moneyRule.optional(),
    reorderThresholdG: decimalQtyRule.nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

// ── Components ──────────────────────────────────────────────────────────
export const createComponentValidator = vine.compile(
  vine.object({
    sku: skuRule,
    name: nameRule,
    defaultSupplierId: vine.number().positive().optional(),
    defaultUnitCost: moneyRule,
    reorderThresholdQty: vine.number().min(0).optional(),
  })
)

export const updateComponentValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    defaultSupplierId: vine.number().positive().nullable().optional(),
    defaultUnitCost: moneyRule.optional(),
    reorderThresholdQty: vine.number().min(0).nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

// ── Product Categories ──────────────────────────────────────────────────
export const createProductCategoryValidator = vine.compile(
  vine.object({
    name: nameRule,
    defaultProfitPct: percentRule.optional(),
    taxRatePct: percentRule.optional(),
  })
)

export const updateProductCategoryValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    defaultProfitPct: percentRule.nullable().optional(),
    taxRatePct: percentRule.nullable().optional(),
  })
)

// ── Products ────────────────────────────────────────────────────────────
export const createProductValidator = vine.compile(
  vine.object({
    sku: skuRule,
    name: nameRule,
    description: vine.string().trim().maxLength(2000).optional(),
    categoryId: vine.number().positive().optional(),
    defaultProfitPct: percentRule.optional(),
    taxRatePct: percentRule.optional(),
  })
)

export const updateProductValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    categoryId: vine.number().positive().nullable().optional(),
    defaultProfitPct: percentRule.nullable().optional(),
    taxRatePct: percentRule.nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

// ── Inventory adjustments ───────────────────────────────────────────────
export const adjustInventoryValidator = vine.compile(
  vine.object({
    itemKind: vine.enum(['material', 'component']),
    itemId: vine.number().positive(),
    qtyDelta: vine.number().min(-999_999_999).max(999_999_999),
    unitCost: moneyRule.optional(),
    note: vine.string().trim().minLength(3).maxLength(500),
  })
)
