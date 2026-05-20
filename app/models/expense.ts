import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ExpenseSchema } from '#database/schema'
import ProductionJob from '#models/production_job'
import Machine from '#models/machine'

export default class Expense extends ExpenseSchema {
  @belongsTo(() => ProductionJob, { foreignKey: 'jobId' })
  declare job: BelongsTo<typeof ProductionJob>

  @belongsTo(() => Machine, { foreignKey: 'machineId' })
  declare machine: BelongsTo<typeof Machine>
}
