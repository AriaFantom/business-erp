import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { MachineSchema } from '#database/schema'
import ProductionJob from '#models/production_job'
import PurchaseItem from '#models/purchase_item'

export default class Machine extends MachineSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'currentJobId' })
  declare currentJob: BelongsTo<typeof ProductionJob>

  @belongsTo(() => PurchaseItem, { foreignKey: 'purchaseItemId' })
  declare purchaseItem: BelongsTo<typeof PurchaseItem>

  @hasMany(() => ProductionJob, { foreignKey: 'machineId' })
  declare jobs: HasMany<typeof ProductionJob>
}
