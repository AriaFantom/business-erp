import vine from '@vinejs/vine'

export const createWorkerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    phone: vine.string().trim().maxLength(40).optional(),
    notes: vine.string().trim().maxLength(2000).optional(),
    payType: vine.enum(['hourly', 'monthly']),
    hourlyRate: vine.number().min(0).max(99_999_999_999).optional(),
    monthlySalary: vine.number().min(0).max(99_999_999_999).optional(),
    standardMonthlyHours: vine.number().min(1).max(744).optional(),
    joinedAt: vine.date({ formats: { utc: true } }).optional(),
  })
)

export const updateWorkerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80).optional(),
    phone: vine.string().trim().maxLength(40).nullable().optional(),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
    payType: vine.enum(['hourly', 'monthly']).optional(),
    hourlyRate: vine.number().min(0).max(99_999_999_999).optional(),
    monthlySalary: vine.number().min(0).max(99_999_999_999).optional(),
    standardMonthlyHours: vine.number().min(1).max(744).optional(),
  })
)

export const workerPaymentValidator = vine.compile(
  vine.object({
    amount: vine.number().min(0.01).max(99_999_999_999),
    kind: vine.enum(['wages', 'salary', 'advance', 'bonus', 'other']),
    periodStart: vine.date({ formats: { utc: true } }).optional(),
    periodEnd: vine.date({ formats: { utc: true } }).optional(),
    note: vine.string().trim().maxLength(500).optional(),
    paidAt: vine.date({ formats: { utc: true } }).optional(),
  })
)
