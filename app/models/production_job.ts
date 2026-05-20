import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductionJobSchema } from '#database/schema'
import Product from '#models/product'
import User from '#models/user'
import JobMaterialConsumption from '#models/job_material_consumption'
import Expense from '#models/expense'
import Machine from '#models/machine'
import ProductionJobStage from '#models/production_job_stage'

export default class ProductionJob extends ProductionJobSchema {
  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => ProductionJob, { foreignKey: 'parentJobId' })
  declare parentJob: BelongsTo<typeof ProductionJob>

  @hasMany(() => JobMaterialConsumption, { foreignKey: 'jobId' })
  declare consumptions: HasMany<typeof JobMaterialConsumption>

  @hasMany(() => Expense, { foreignKey: 'jobId' })
  declare expenses: HasMany<typeof Expense>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => Machine, { foreignKey: 'machineId' })
  declare machine: BelongsTo<typeof Machine>

  @hasMany(() => ProductionJobStage, { foreignKey: 'jobId' })
  declare stages: HasMany<typeof ProductionJobStage>

  @belongsTo(() => ProductionJobStage, { foreignKey: 'currentStageId' })
  declare currentStage: BelongsTo<typeof ProductionJobStage>
}
