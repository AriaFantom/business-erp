import vine from '@vinejs/vine'

export const createPrinterValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    model: vine.string().trim().maxLength(80).optional(),
    serialNumber: vine.string().trim().maxLength(80).optional(),
    notes: vine.string().trim().maxLength(2000).optional(),
  })
)

export const updatePrinterValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80).optional(),
    model: vine.string().trim().maxLength(80).nullable().optional(),
    serialNumber: vine.string().trim().maxLength(80).nullable().optional(),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
  })
)

export const printerExpenseValidator = vine.compile(
  vine.object({
    kind: vine.enum(['maintenance', 'parts', 'addon', 'other']),
    description: vine.string().trim().minLength(1).maxLength(280),
    amount: vine.number().min(0.01).max(99_999_999_999),
    incurredAt: vine.date({ formats: { utc: true } }).optional(),
  })
)
