import { belongsTo, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import { OrderSchema } from '#database/schema'
import Customer from '#models/customer'
import Quotation from '#models/quotation'
import User from '#models/user'
import OrderItem from '#models/order_item'
import Invoice from '#models/invoice'

export default class Order extends OrderSchema {
  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

  @belongsTo(() => Quotation)
  declare quotation: BelongsTo<typeof Quotation>

  @hasMany(() => OrderItem)
  declare items: HasMany<typeof OrderItem>

  @hasOne(() => Invoice)
  declare invoice: HasOne<typeof Invoice>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
