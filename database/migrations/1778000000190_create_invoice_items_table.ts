import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoice_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('invoice_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('invoices')
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
      table.decimal('tax_rate_pct', 5, 2).notNullable().defaultTo(0)
      table.decimal('line_subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('line_tax', 14, 2).notNullable().defaultTo(0)
      table.decimal('line_total', 14, 2).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['invoice_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
