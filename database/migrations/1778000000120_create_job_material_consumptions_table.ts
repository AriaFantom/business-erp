import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'job_material_consumptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('job_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('CASCADE')
      table.string('item_kind').notNullable()
      table.integer('item_id').unsigned().notNullable()
      table.decimal('qty_consumed', 14, 3).notNullable()
      table.decimal('qty_wasted', 14, 3).notNullable().defaultTo(0)
      table.decimal('unit_cost_at_consume', 14, 4).notNullable()
      table.decimal('line_cost', 14, 2).notNullable()
      // 'consume' | 'reprint' | 'waste'
      table.string('reason').notNullable().defaultTo('consume')
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at').notNullable()
      table.index(['job_id'])
      table.index(['item_kind', 'item_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
