import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('sku').notNullable().unique()
      table.string('name').notNullable()
      table.text('description').nullable()
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_categories')
        .onDelete('SET NULL')
      table.decimal('default_profit_pct', 5, 2).nullable()
      table.decimal('tax_rate_pct', 5, 2).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.string('image_key').nullable()
      table.timestamps(true, true)
      table.index(['is_active', 'category_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
