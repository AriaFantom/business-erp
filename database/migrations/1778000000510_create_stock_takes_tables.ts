import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('stock_takes', (table) => {
      table.increments('id')
      table.string('number').notNullable().unique()
      // 'draft' | 'completed' | 'cancelled'
      table.string('status').notNullable().defaultTo('draft')
      table.text('note').nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('completed_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['status'])
    })

    this.schema.createTable('stock_take_items', (table) => {
      table.increments('id')
      table
        .integer('stock_take_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('stock_takes')
        .onDelete('CASCADE')
      // 'material' | 'component' | 'product'
      table.string('item_kind').notNullable()
      table.integer('item_id').unsigned().notNullable()
      // System qty snapshotted when the line was added / recounted.
      table.decimal('expected_qty', 14, 3).notNullable().defaultTo(0)
      // NULL until someone actually counts the line.
      table.decimal('counted_qty', 14, 3).nullable()
      // Avg unit cost snapshot for valuing the variance.
      table.decimal('unit_cost', 14, 4).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.unique(['stock_take_id', 'item_kind', 'item_id'])
      table.index(['stock_take_id'])
    })
  }

  async down() {
    this.schema.dropTable('stock_take_items')
    this.schema.dropTable('stock_takes')
  }
}
