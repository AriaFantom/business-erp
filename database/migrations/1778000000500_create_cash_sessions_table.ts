import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('cash_sessions', (table) => {
      table.increments('id')
      table.string('number').notNullable().unique()
      // 'open' | 'closed'
      table.string('status').notNullable().defaultTo('open')
      table
        .integer('opened_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('opened_at', { useTz: true }).notNullable()
      table.decimal('opening_float', 14, 2).notNullable().defaultTo(0)
      table
        .integer('closed_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('closed_at', { useTz: true }).nullable()
      // Filled at close time: expected = float + cash payments − cash refunds.
      table.decimal('expected_cash', 14, 2).nullable()
      table.decimal('counted_cash', 14, 2).nullable()
      table.decimal('variance', 14, 2).nullable()
      table.text('note').nullable()
      table.timestamps(true, true)
      table.index(['status'])
    })

    this.schema.alterTable('invoice_payments', (table) => {
      table
        .integer('cash_session_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('cash_sessions')
        .onDelete('SET NULL')
      table.index(['cash_session_id'])
    })
  }

  async down() {
    this.schema.alterTable('invoice_payments', (table) => {
      table.dropColumn('cash_session_id')
    })
    this.schema.dropTable('cash_sessions')
  }
}
