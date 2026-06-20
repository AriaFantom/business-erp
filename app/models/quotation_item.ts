import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { QuotationItemSchema } from '#database/schema'
import Quotation from '#models/quotation'
import Product from '#models/product'
import QuotationItemBom from '#models/quotation_item_bom'

export default class QuotationItem extends QuotationItemSchema {
  @belongsTo(() => Quotation)
  declare quotation: BelongsTo<typeof Quotation>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @hasMany(() => QuotationItemBom)
  declare boms: HasMany<typeof QuotationItemBom>
}
