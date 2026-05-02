import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductionJobSchema } from '#database/schema'
import Product from '#models/product'
import User from '#models/user'
import JobMaterialConsumption from '#models/job_material_consumption'
import JobExpense from '#models/job_expense'

export default class ProductionJob extends ProductionJobSchema {
  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => ProductionJob, { foreignKey: 'parentJobId' })
  declare parentJob: BelongsTo<typeof ProductionJob>

  @hasMany(() => JobMaterialConsumption, { foreignKey: 'jobId' })
  declare consumptions: HasMany<typeof JobMaterialConsumption>

  @hasMany(() => JobExpense, { foreignKey: 'jobId' })
  declare expenses: HasMany<typeof JobExpense>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
