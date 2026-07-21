import vine from '@vinejs/vine'

// ── Create ─────────────────────────────────────────────────────────────
export const createStockTakeValidator = vine.compile(
  vine.object({
    note: vine.string().trim().maxLength(500).optional(),
  })
)

// ── Save counts ───────────────────────────────────────────────────────
const countLineRule = vine.object({
  itemKind: vine.enum(['material', 'component', 'product']),
  itemId: vine.number().positive(),
  countedQty: vine.number().min(0).nullable(),
})

export const saveStockTakeCountsValidator = vine.compile(
  vine.object({
    counts: vine.array(countLineRule).minLength(0).maxLength(5000),
  })
)
