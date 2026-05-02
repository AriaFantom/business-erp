import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { InvoiceItemSchema } from '#database/schema'
import Invoice from '#models/invoice'
import Product from '#models/product'

export default class InvoiceItem extends InvoiceItemSchema {
  @belongsTo(() => Invoice)
  declare invoice: BelongsTo<typeof Invoice>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
