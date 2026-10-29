import vine from '@vinejs/vine'

const moneyRule = vine.number().min(0).max(99_999_999_999)
const chargeRule = vine.number().min(0).max(99_999_999_999).decimal([0, 2])
const qtyRule = vine.number().min(0.001).max(999_999_999)
const percentRule = vine.number().min(0).max(100)

const lineRule = vine.object({
  itemKind: vine.enum(['material', 'component']),
  itemId: vine.number().positive(),
  qty: qtyRule,
  unitCost: moneyRule,
  taxRatePct: percentRule.optional(),
})

export const createPurchaseValidator = vine.compile(
  vine.object({
    supplierId: vine.number().positive(),
    purchasedAt: vine.date({ formats: { utc: true } }).optional(),
    note: vine.string().trim().maxLength(2000).optional(),
    shippingCharge: chargeRule.optional(),
    taxAmount: chargeRule.optional(),
    items: vine.array(lineRule).minLength(1).maxLength(200),
  })
)

export const payPurchaseValidator = vine.compile(
  vine.object({
    amount: vine.number().min(0.01).max(99_999_999_999),
    method: vine.enum(['cash', 'bank', 'upi', 'other']),
    reference: vine.string().trim().maxLength(200).optional(),
    note: vine.string().trim().maxLength(2000).optional(),
  })
)

export const returnPurchaseValidator = vine.compile(
  vine.object({
    items: vine
      .array(
        vine.object({
          purchaseItemId: vine.number().positive().withoutDecimals(),
          qty: qtyRule,
        })
      )
      .minLength(1)
      .maxLength(200),
    note: vine.string().trim().maxLength(2000).optional(),
  })
)
