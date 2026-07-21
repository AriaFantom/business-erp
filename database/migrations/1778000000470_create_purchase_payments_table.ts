import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('purchase_payments', (table) => {
      table.increments('id')
      table
        .integer('purchase_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('purchases')
        .onDelete('RESTRICT')
      table.decimal('amount', 14, 2).notNullable()
      // 'cash' | 'bank' | 'upi' | 'other' — mirrors invoice_payments.method
      table.string('method').notNullable()
      table.timestamp('paid_at', { useTz: true }).notNullable()
      table.string('reference').nullable()
      table.text('note').nullable()
      table
        .integer('recorded_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['purchase_id'])
    })
    this.schema.raw(
      `ALTER TABLE purchase_payments
       ADD CONSTRAINT purchase_payments_amount_positive CHECK (amount > 0)`
    )

    this.schema.alterTable('purchases', (table) => {
      // Denormalized sum of purchase_payments, maintained by the service
      // (same pattern as invoices.paid_total).
      table.decimal('paid_total', 14, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('purchases', (table) => {
      table.dropColumn('paid_total')
    })
    this.schema.dropTable('purchase_payments')
  }
}
