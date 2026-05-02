import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ComponentSchema } from '#database/schema'
import Supplier from '#models/supplier'

export default class Component extends ComponentSchema {
  @belongsTo(() => Supplier, { foreignKey: 'defaultSupplierId' })
  declare defaultSupplier: BelongsTo<typeof Supplier>
}
