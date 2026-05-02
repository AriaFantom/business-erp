import vine from '@vinejs/vine'

const lineRule = vine.object({
  productId: vine.number().positive().optional(),
  description: vine.string().trim().minLength(1).maxLength(280),
  qty: vine.number().min(1).max(1_000_000),
  unitPrice: vine.number().min(0).max(99_999_999_999),
  taxRatePct: vine.number().min(0).max(100),
})

export const createSaleValidator = vine.compile(
  vine.object({
    customerId: vine.number().positive(),
    quotationId: vine.number().positive().optional(),
    note: vine.string().trim().maxLength(2000).optional(),
    items: vine.array(lineRule).minLength(1).maxLength(200),
  })
)

export const recordPaymentValidator = vine.compile(
  vine.object({
    amount: vine.number().min(0.01).max(99_999_999_999),
    method: vine.enum(['cash', 'bank', 'upi', 'other']),
    paidAt: vine.date({ formats: { utc: true } }).optional(),
    reference: vine.string().trim().maxLength(280).optional(),
  })
)
