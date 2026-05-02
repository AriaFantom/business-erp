import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { MaterialSchema } from '#database/schema'
import Supplier from '#models/supplier'

export default class Material extends MaterialSchema {
  @belongsTo(() => Supplier, { foreignKey: 'defaultSupplierId' })
  declare defaultSupplier: BelongsTo<typeof Supplier>
}
