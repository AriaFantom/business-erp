import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { JobExpenseSchema } from '#database/schema'
import ProductionJob from '#models/production_job'

export default class JobExpense extends JobExpenseSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof ProductionJob>
}
