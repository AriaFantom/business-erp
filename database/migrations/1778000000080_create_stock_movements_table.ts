import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_movements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('item_kind').notNullable()
      table.integer('item_id').unsigned().notNullable()
      // Signed: positive = inbound, negative = outbound
      table.decimal('qty', 14, 3).notNullable()
      table.decimal('unit_cost', 14, 4).notNullable().defaultTo(0)
      // 'purchase' | 'job_consume' | 'job_return' | 'adjustment_increase' | 'adjustment_decrease'
      table.string('reason').notNullable()
      table.string('reference_type').nullable()
      table.integer('reference_id').nullable()
      table.text('note').nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at').notNullable()
      table.index(['item_kind', 'item_id', 'created_at'])
      table.index(['reference_type', 'reference_id'])
      table.index(['reason', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
