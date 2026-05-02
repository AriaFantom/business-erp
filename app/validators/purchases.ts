import vine from '@vinejs/vine'

const moneyRule = vine.number().min(0).max(99_999_999_999)
const qtyRule = vine.number().min(0.001).max(999_999_999)
const percentRule = vine.number().min(0).max(100)

const lineRule = vine.object({
  itemKind: vine.enum(['material', 'component']),
  itemId: vine.number().positive(),
  qty: qtyRule,
  unitCost: moneyRule,
  taxRatePct: percentRule,
})

export const createPurchaseValidator = vine.compile(
  vine.object({
    supplierId: vine.number().positive(),
    purchasedAt: vine.date({ formats: { utc: true } }).optional(),
    note: vine.string().trim().maxLength(2000).optional(),
    items: vine.array(lineRule).minLength(1).maxLength(200),
  })
)
