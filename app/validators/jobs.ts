import vine from '@vinejs/vine'

export const createJobValidator = vine.compile(
  vine.object({
    productId: vine.number().positive(),
    plannedQty: vine.number().min(1).max(1_000_000),
    parentJobId: vine.number().positive().optional(),
    note: vine.string().trim().maxLength(2000).optional(),
  })
)

export const consumeMaterialValidator = vine.compile(
  vine.object({
    itemKind: vine.enum(['material', 'component']),
    itemId: vine.number().positive(),
    qtyConsumed: vine.number().min(0.001).max(999_999_999),
    qtyWasted: vine.number().min(0).max(999_999_999).optional(),
    reason: vine.enum(['consume', 'reprint', 'waste']).optional(),
  })
)

export const addExpenseValidator = vine.compile(
  vine.object({
    kind: vine.enum(['electricity', 'labor', 'overhead', 'other']),
    description: vine.string().trim().minLength(1).maxLength(280),
    amount: vine.number().min(0.01).max(99_999_999_999),
    incurredAt: vine.date({ formats: { utc: true } }).optional(),
  })
)

export const completeJobValidator = vine.compile(
  vine.object({
    producedQty: vine.number().min(1).max(1_000_000),
  })
)

export const failJobValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().maxLength(500).optional(),
  })
)

export const startJobValidator = vine.compile(
  vine.object({
    printerId: vine.number().positive(),
    stages: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1).maxLength(80),
          durationMinutes: vine
            .number()
            .min(1)
            .max(60 * 24 * 14), // up to 14 days
        })
      )
      .minLength(1)
      .maxLength(20),
  })
)

export const confirmJobValidator = vine.compile(
  vine.object({
    producedQty: vine.number().min(0).max(1_000_000),
  })
)
