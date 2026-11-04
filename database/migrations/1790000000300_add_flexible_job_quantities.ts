import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('inventory', (table) => {
      table.decimal('qty', 20, 9).notNullable().defaultTo(0).alter()
    })
    this.schema.alterTable('stock_movements', (table) => {
      table.decimal('qty', 20, 9).notNullable().alter()
    })
    this.schema.alterTable('job_material_consumptions', (table) => {
      table.decimal('qty_consumed', 20, 9).notNullable().alter()
      table.decimal('qty_wasted', 20, 9).notNullable().defaultTo(0).alter()
      table.decimal('qty_returned', 20, 9).notNullable().defaultTo(0).alter()
    })
    this.schema.alterTable('stock_take_items', (table) => {
      table.decimal('expected_qty', 20, 9).notNullable().defaultTo(0).alter()
      table.decimal('counted_qty', 20, 9).nullable().alter()
    })
    this.schema.alterTable('product_recipes', (table) => {
      table.decimal('qty_per_unit', 21, 9).notNullable().alter()
    })
    this.schema.alterTable('production_jobs', (table) => {
      table.string('completion_time_basis').notNullable().defaultTo('elapsed')
    })
  }

  async down() {
    this.schema.alterTable('production_jobs', (table) => {
      table.dropColumn('completion_time_basis')
    })
    this.schema.alterTable('product_recipes', (table) => {
      table.decimal('qty_per_unit', 18, 6).notNullable().alter()
    })
    this.schema.alterTable('stock_take_items', (table) => {
      table.decimal('expected_qty', 14, 3).notNullable().defaultTo(0).alter()
      table.decimal('counted_qty', 14, 3).nullable().alter()
    })
    this.schema.alterTable('job_material_consumptions', (table) => {
      table.decimal('qty_consumed', 14, 3).notNullable().alter()
      table.decimal('qty_wasted', 14, 3).notNullable().defaultTo(0).alter()
      table.decimal('qty_returned', 14, 3).notNullable().defaultTo(0).alter()
    })
    this.schema.alterTable('stock_movements', (table) => {
      table.decimal('qty', 14, 3).notNullable().alter()
    })
    this.schema.alterTable('inventory', (table) => {
      table.decimal('qty', 14, 3).notNullable().defaultTo(0).alter()
    })
  }
}
