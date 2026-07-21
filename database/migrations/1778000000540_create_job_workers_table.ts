import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'job_workers'

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
      table
        .integer('worker_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('workers')
        .onDelete('RESTRICT')
      table.timestamp('assigned_at', { useTz: true }).notNullable()
      table.timestamp('released_at', { useTz: true }).nullable()
      table.integer('minutes_worked').notNullable().defaultTo(0)
      // Effective hourly rate snapshotted at assign time so historical job
      // costs stay stable when a worker's pay later changes.
      table.decimal('hourly_rate_at_assign', 14, 2).notNullable().defaultTo(0)
      table.decimal('line_cost', 14, 2).notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.unique(['job_id', 'worker_id'])
      table.index(['worker_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
