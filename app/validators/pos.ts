import vine from '@vinejs/vine'

export const posSellValidator = vine.compile(
  vine.object({
    customerId: vine.number().positive(),
    paymentMethod: vine.enum(['cash', 'bank', 'upi', 'other']),
    paymentReference: vine.string().trim().maxLength(120).optional(),
    idempotencyKey: vine.string().trim().minLength(8).maxLength(64).optional(),
    items: vine
      .array(
        vine.object({
          productId: vine.number().positive(),
          qty: vine.number().positive().max(99_999),
          // Optional: when omitted (or equal to the suggestion) the server
          // charges the suggested price. Tax is always server-derived.
          unitPrice: vine.number().min(0).max(99_999_999_999).optional(),
        })
      )
      .minLength(1)
      .maxLength(200),
  })
)
