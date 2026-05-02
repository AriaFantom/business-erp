import { belongsTo, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import { SaleSchema } from '#database/schema'
import Customer from '#models/customer'
import Quotation from '#models/quotation'
import User from '#models/user'
import SaleItem from '#models/sale_item'
import Invoice from '#models/invoice'

export default class Sale extends SaleSchema {
  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

  @belongsTo(() => Quotation)
  declare quotation: BelongsTo<typeof Quotation>

  @hasMany(() => SaleItem)
  declare items: HasMany<typeof SaleItem>

  @hasOne(() => Invoice)
  declare invoice: HasOne<typeof Invoice>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
