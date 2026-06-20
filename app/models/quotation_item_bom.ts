import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { QuotationItemBomSchema } from '#database/schema'
import QuotationItem from '#models/quotation_item'

export default class QuotationItemBom extends QuotationItemBomSchema {
  @belongsTo(() => QuotationItem)
  declare quotationItem: BelongsTo<typeof QuotationItem>
}
