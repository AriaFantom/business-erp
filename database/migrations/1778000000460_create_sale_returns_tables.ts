import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('sale_returns', (table) => {
      table.increments('id')
      // Credit-note number (CN-YYYY-nnnnnn).
      table.string('number').notNullable().unique()
      table
        .integer('sale_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('sales')
        .onDelete('RESTRICT')
      table
        .integer('invoice_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('invoices')
        .onDelete('SET NULL')
      table
        .integer('customer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('customers')
        .onDelete('RESTRICT')
      table.decimal('subtotal', 14, 2).notNullable().defaultTo(0)
      table.decimal('tax_total', 14, 2).notNullable().defaultTo(0)
      table.decimal('total', 14, 2).notNullable().defaultTo(0)
      // Split of the credit: applied against the invoice's unpaid remainder
      // vs refunded to the customer (cash out).
      table.decimal('credit_applied', 14, 2).notNullable().defaultTo(0)
      table.decimal('refund_amount', 14, 2).notNullable().defaultTo(0)
      // 'cash' | 'bank' | 'upi' | 'other' — null when nothing was refunded.
      table.string('refund_method').nullable()
      table.text('note').nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['sale_id'])
      table.index(['invoice_id'])
      table.index(['customer_id'])
    })

    this.schema.createTable('sale_return_items', (table) => {
      table.increments('id')
      table
        .integer('sale_return_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('sale_returns')
        .onDelete('CASCADE')
      table
        .integer('sale_item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('sale_items')
        .onDelete('RESTRICT')
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
      table.index(['sale_return_id'])
      table.index(['sale_item_id'])
    })
    this.schema.raw(
      `ALTER TABLE sale_return_items
       ADD CONSTRAINT sale_return_items_qty_positive CHECK (qty > 0)`
    )

    // Credits issued against an invoice count toward settling it:
    // status becomes 'paid' when paid_total + credit_total >= total.
    this.schema.alterTable('invoices', (table) => {
      table.decimal('credit_total', 14, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('invoices', (table) => {
      table.dropColumn('credit_total')
    })
    this.schema.dropTable('sale_return_items')
    this.schema.dropTable('sale_returns')
  }
}
