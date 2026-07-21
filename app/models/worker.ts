import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { WorkerSchema } from '#database/schema'
import ProductionJob from '#models/production_job'
import JobWorker from '#models/job_worker'
import WorkerPayment from '#models/worker_payment'

export default class Worker extends WorkerSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'currentJobId' })
  declare currentJob: BelongsTo<typeof ProductionJob>

  @hasMany(() => JobWorker, { foreignKey: 'workerId' })
  declare assignments: HasMany<typeof JobWorker>

  @hasMany(() => WorkerPayment, { foreignKey: 'workerId' })
  declare payments: HasMany<typeof WorkerPayment>
}
