import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductRecipeSchema } from '#database/schema'
import Product from '#models/product'
import ProductionJob from '#models/production_job'

export default class ProductRecipe extends ProductRecipeSchema {
  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => ProductionJob, { foreignKey: 'learnedFromJobId' })
  declare learnedFromJob: BelongsTo<typeof ProductionJob>
}
