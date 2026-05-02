import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { QuotationItemSchema } from '#database/schema'
import Quotation from '#models/quotation'
import Product from '#models/product'

export default class QuotationItem extends QuotationItemSchema {
  @belongsTo(() => Quotation)
  declare quotation: BelongsTo<typeof Quotation>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
