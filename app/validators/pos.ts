import vine from '@vinejs/vine'

export const posSellValidator = vine.compile(
  vine.object({
    customerId: vine.number().positive(),
    paymentMethod: vine.enum(['cash', 'bank', 'upi', 'other']),
    paymentReference: vine.string().trim().maxLength(120).optional(),
    items: vine
      .array(
        vine.object({
          productId: vine.number().positive(),
          qty: vine.number().positive().max(99_999),
          unitPrice: vine.number().min(0).max(99_999_999_999),
          taxRatePct: vine.number().min(0).max(100),
        })
      )
      .minLength(1)
      .maxLength(200),
  })
)
