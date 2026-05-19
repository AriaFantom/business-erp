import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_recipes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      // 'material' | 'component'
      table.string('item_kind').notNullable()
      table.integer('item_id').unsigned().notNullable()
      table.decimal('qty_per_unit', 18, 6).notNullable()
      table
        .integer('learned_from_job_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.unique(['product_id', 'item_kind', 'item_id'])
      table.index(['product_id'])
    })
    this.schema.raw(
      `ALTER TABLE product_recipes ADD CONSTRAINT product_recipes_qty_positive CHECK (qty_per_unit > 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
