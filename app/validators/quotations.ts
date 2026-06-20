import vine from '@vinejs/vine'

const bomLineRule = vine.object({
  itemKind: vine.enum(['material', 'component']),
  itemId: vine.number().positive(),
  qty: vine.number().min(0).max(1_000_000),
})

const lineRule = vine.object({
  productId: vine.number().positive().optional(),
  name: vine.string().trim().minLength(1).maxLength(120),
  qty: vine.number().min(1).max(1_000_000),
  unitPrice: vine.number().min(0).max(99_999_999_999).optional(),
  profitPctOverride: vine.number().min(0).max(1000).optional(),
  taxRatePct: vine.number().min(0).max(100).optional(),
  boms: vine.array(bomLineRule).optional(),
})

export const createQuotationValidator = vine.compile(
  vine.object({
    customerId: vine.number().positive(),
    validUntil: vine.date({ formats: { utc: true } }),
    note: vine.string().trim().maxLength(2000).optional(),
    items: vine.array(lineRule).minLength(1).maxLength(200),
  })
)

export const suggestPriceValidator = vine.compile(
  vine.object({
    productId: vine.number().positive(),
    qty: vine.number().min(1).max(1_000_000).optional(),
  })
)
