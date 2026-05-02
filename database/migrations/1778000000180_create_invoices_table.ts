import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('number').notNullable().unique()
      table
        .integer('sale_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('sales')
        .onDelete('RESTRICT')
      table
        .integer('customer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('customers')
        .onDelete('RESTRICT')
      // 'unpaid' | 'partial' | 'paid' | 'void'
      table.string('status').notNullable().defaultTo('unpaid')
      table.timestamp('issued_at').notNullable()
      table.timestamp('due_at').notNullable()
      table.decimal('subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('tax_total', 14, 2).notNullable().defaultTo(0)
      table.decimal('total', 14, 2).notNullable().defaultTo(0)
      table.decimal('paid_total', 14, 2).notNullable().defaultTo(0)
      table.string('pdf_key').nullable()
      table
        .integer('replaces_invoice_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('invoices')
        .onDelete('SET NULL')
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['status', 'issued_at'])
      table.index(['customer_id'])
      table.index(['due_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
