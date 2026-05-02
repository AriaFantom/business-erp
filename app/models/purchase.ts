import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { PurchaseSchema } from '#database/schema'
import Supplier from '#models/supplier'
import User from '#models/user'
import PurchaseItem from '#models/purchase_item'

export default class Purchase extends PurchaseSchema {
  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>

  @hasMany(() => PurchaseItem)
  declare items: HasMany<typeof PurchaseItem>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'confirmedByUserId' })
  declare confirmedBy: BelongsTo<typeof User>
}
