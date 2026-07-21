import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'worker_payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('worker_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('workers')
        .onDelete('RESTRICT')
      table.decimal('amount', 14, 2).notNullable()
      // 'wages' | 'salary' | 'advance' | 'bonus' | 'other'
      table.string('kind').notNullable()
      // Optional pay period this payment covers (payslip range).
      table.date('period_start').nullable()
      table.date('period_end').nullable()
      table.text('note').nullable()
      table.timestamp('paid_at', { useTz: true }).notNullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['worker_id'])
    })
    this.schema.raw(
      `ALTER TABLE worker_payments
       ADD CONSTRAINT worker_payments_amount_positive CHECK (amount > 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
