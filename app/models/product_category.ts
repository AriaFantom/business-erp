import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { ProductCategorySchema } from '#database/schema'
import Product from '#models/product'

export default class ProductCategory extends ProductCategorySchema {
  @hasMany(() => Product, { foreignKey: 'categoryId' })
  declare products: HasMany<typeof Product>
}
