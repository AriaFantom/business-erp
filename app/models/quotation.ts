import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { QuotationSchema } from '#database/schema'
import Customer from '#models/customer'
import User from '#models/user'
import QuotationItem from '#models/quotation_item'

export default class Quotation extends QuotationSchema {
  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

  @hasMany(() => QuotationItem)
  declare items: HasMany<typeof QuotationItem>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
