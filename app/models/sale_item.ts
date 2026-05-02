import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SaleItemSchema } from '#database/schema'
import Sale from '#models/sale'
import Product from '#models/product'

export default class SaleItem extends SaleItemSchema {
  @belongsTo(() => Sale)
  declare sale: BelongsTo<typeof Sale>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
