import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { JobMaterialConsumptionSchema } from '#database/schema'
import ProductionJob from '#models/production_job'

export default class JobMaterialConsumption extends JobMaterialConsumptionSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof ProductionJob>
}
