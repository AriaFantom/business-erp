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
    creditLimit: vine.number().min(0).max(99_999_999_999).nullable().optional(),
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
    creditLimit: vine.number().min(0).max(99_999_999_999).nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

const unitRule = vine.string().trim().minLength(1).maxLength(16)

// ── Materials ───────────────────────────────────────────────────────────
export const createMaterialValidator = vine.compile(
  vine.object({
    sku: skuRule,
    name: nameRule,
    type: vine.enum(['filament', 'resin', 'other']),
    unit: unitRule.optional(),
    defaultSupplierId: vine.number().positive().optional(),
    defaultUnitCost: moneyRule,
    reorderThresholdG: decimalQtyRule.optional(),
    image: vine.file({ size: '15mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }).optional(),
  })
)

export const updateMaterialValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    type: vine.enum(['filament', 'resin', 'other']).optional(),
    unit: unitRule.optional(),
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
    unit: unitRule.optional(),
    defaultSupplierId: vine.number().positive().optional(),
    defaultUnitCost: moneyRule,
    reorderThresholdQty: vine.number().min(0).optional(),
    image: vine.file({ size: '15mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }).optional(),
  })
)

export const updateComponentValidator = vine.compile(
  vine.object({
    name: nameRule.optional(),
    unit: unitRule.optional(),
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

// ── Catalog image upload ────────────────────────────────────────────────
export const uploadCatalogImageValidator = vine.compile(
  vine.object({
    image: vine.file({ size: '15mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }),
  })
)

// ── Product 3D-model file upload ────────────────────────────────────────
export const uploadProductFileValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '50mb',
      extnames: ['stl', '3mf', 'obj', 'step', 'stp', 'igs', 'iges', 'ply', 'gcode', 'zip'],
    }),
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

// ── Product default price ───────────────────────────────────────────────
export const setProductDefaultPriceValidator = vine.compile(
  vine.object({
    price: vine.number().positive(),
    sourceJobId: vine.number().positive().optional().nullable(),
  })
)

// ── Product images upload ───────────────────────────────────────────────
export const uploadProductImagesValidator = vine.compile(
  vine.object({
    images: vine
      .array(
        vine.file({
          size: '15mb',
          extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        })
      )
      .minLength(1)
      .maxLength(10),
  })
)

// ── Product images reorder ──────────────────────────────────────────────
export const reorderProductImagesValidator = vine.compile(
  vine.object({
    items: vine
      .array(
        vine.object({
          id: vine.number().positive(),
          sortOrder: vine.number(),
        })
      )
      .minLength(1),
  })
)
