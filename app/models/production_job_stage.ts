import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductionJobStageSchema } from '#database/schema'
import ProductionJob from '#models/production_job'

export default class ProductionJobStage extends ProductionJobStageSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof ProductionJob>
}
