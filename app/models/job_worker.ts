import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { JobWorkerSchema } from '#database/schema'
import ProductionJob from '#models/production_job'
import Worker from '#models/worker'

export default class JobWorker extends JobWorkerSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof ProductionJob>

  @belongsTo(() => Worker, { foreignKey: 'workerId' })
  declare worker: BelongsTo<typeof Worker>
}
