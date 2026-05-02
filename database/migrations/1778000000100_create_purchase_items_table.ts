import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'purchase_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('purchase_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('purchases')
        .onDelete('CASCADE')
      table.string('item_kind').notNullable()
      table.integer('item_id').unsigned().notNullable()
      table.decimal('qty', 14, 3).notNullable()
      table.decimal('unit_cost', 14, 4).notNullable()
      table.decimal('tax_rate_pct', 5, 2).notNullable().defaultTo(0)
      table.decimal('line_subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('line_tax', 14, 2).notNullable().defaultTo(0)
      table.decimal('line_total', 14, 2).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['purchase_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
