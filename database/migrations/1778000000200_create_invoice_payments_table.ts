import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoice_payments'

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
      table.decimal('amount', 14, 2).notNullable()
      // 'cash' | 'bank' | 'upi' | 'other'
      table.string('method').notNullable()
      table.timestamp('paid_at').notNullable()
      table.string('reference').nullable()
      table
        .integer('recorded_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['invoice_id', 'paid_at'])
    })
    this.schema.raw(
      `ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_amount_pos CHECK (amount > 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
