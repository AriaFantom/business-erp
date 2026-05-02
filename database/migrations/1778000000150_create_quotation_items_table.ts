import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quotation_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('quotation_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('quotations')
        .onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('products')
        .onDelete('SET NULL')
      table.string('description').notNullable()
      table.integer('qty').notNullable()
      table.decimal('unit_price', 14, 4).notNullable()
      // null when manual override was used
      table.decimal('profit_pct_used', 5, 2).nullable()
      table.decimal('tax_rate_pct', 5, 2).notNullable().defaultTo(0)
      table.decimal('line_subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('line_tax', 14, 2).notNullable().defaultTo(0)
      table.decimal('line_total', 14, 2).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['quotation_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
