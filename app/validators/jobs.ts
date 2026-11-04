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
    qtyConsumed: vine.number().positive().max(99_999_999_999).decimal([0, 9]),
    qtyWasted: vine.number().min(0).max(99_999_999_999).decimal([0, 9]).optional(),
    unit: vine.string().trim().minLength(1).maxLength(16).optional(),
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
    returnMaterials: vine.boolean().optional(),
  })
)

export const startJobValidator = vine.compile(
  vine.object({
    // Both are optional individually — a job may run on a machine, on people,
    // or on both. The service rejects a start with neither.
    machineId: vine.number().positive().nullable().optional(),
    workerIds: vine.array(vine.number().positive()).distinct().maxLength(50).optional(),
    stages: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1).maxLength(80),
          durationMinutes: vine
            .number()
            .withoutDecimals()
            .min(1)
            .max(60 * 24 * 14), // up to 14 days
        })
      )
      .minLength(1)
      .maxLength(20),
    consumptions: vine
      .array(
        vine.object({
          itemKind: vine.enum(['material', 'component']),
          itemId: vine.number().positive(),
          qtyConsumed: vine.number().positive().max(99_999_999_999).decimal([0, 9]),
          unit: vine.string().trim().minLength(1).maxLength(16).optional(),
        })
      )
      .minLength(1)
      .maxLength(50),
  })
)

export const confirmJobValidator = vine.compile(
  vine.object({
    producedQty: vine.number().min(0).max(1_000_000),
  })
)

export const forceDoneJobValidator = vine.compile(
  vine.object({
    producedQty: vine.number().positive().max(1_000_000).withoutDecimals(),
    machineId: vine.number().positive().nullable().optional(),
    workerIds: vine.array(vine.number().positive()).distinct().maxLength(50).optional(),
    stages: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1).maxLength(80),
          durationMinutes: vine
            .number()
            .withoutDecimals()
            .min(1)
            .max(60 * 24 * 14),
        })
      )
      .minLength(1)
      .maxLength(20)
      .optional(),
    consumptions: vine
      .array(
        vine.object({
          itemKind: vine.enum(['material', 'component']),
          itemId: vine.number().positive(),
          qtyConsumed: vine.number().positive().max(99_999_999_999).decimal([0, 9]),
          unit: vine.string().trim().minLength(1).maxLength(16).optional(),
        })
      )
      .minLength(1)
      .maxLength(50)
      .optional(),
  })
)
