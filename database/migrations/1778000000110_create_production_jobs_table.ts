import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('number').notNullable().unique()
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')
      table
        .integer('parent_job_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('production_jobs')
        .onDelete('SET NULL')
      table.integer('planned_qty').notNullable().defaultTo(1)
      table.integer('produced_qty').notNullable().defaultTo(0)
      // 'draft' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
      table.string('status').notNullable().defaultTo('draft')
      table.timestamp('started_at').nullable()
      table.timestamp('completed_at').nullable()
      table.decimal('total_material_cost', 14, 2).notNullable().defaultTo(0)
      table.decimal('total_component_cost', 14, 2).notNullable().defaultTo(0)
      table.decimal('total_expense', 14, 2).notNullable().defaultTo(0)
      table.decimal('total_cost', 14, 2).notNullable().defaultTo(0)
      table.decimal('unit_cost', 14, 4).notNullable().defaultTo(0)
      table.text('note').nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
      table.index(['status', 'created_at'])
      table.index(['product_id'])
      table.index(['parent_job_id'])
    })
    this.schema.raw(
      `ALTER TABLE production_jobs ADD CONSTRAINT production_jobs_qty_nonneg CHECK (planned_qty >= 0 AND produced_qty >= 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
