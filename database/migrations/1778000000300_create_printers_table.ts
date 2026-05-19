import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'printers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable().unique()
      table.string('model').nullable()
      table.string('serial_number').nullable()
      // 'idle' | 'printing' | 'maintenance' | 'offline' | 'retired'
      table.string('status').notNullable().defaultTo('idle')
      table.integer('current_job_id').unsigned().nullable()
      // FK to production_jobs added in migration 310 (currently nullable so no
      // ordering issue, but we delay the reference until production_jobs has
      // the matching reverse pointer).
      table
        .integer('purchase_item_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('purchase_items')
        .onDelete('SET NULL')
      table.timestamp('acquired_at', { useTz: true }).nullable()
      table.text('notes').nullable()
      table.timestamps(true, true)
      table.index(['status'])
    })
    this.schema.raw(
      `CREATE UNIQUE INDEX printers_current_job_uidx
       ON printers (current_job_id)
       WHERE current_job_id IS NOT NULL`
    )
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS printers_current_job_uidx`)
    this.schema.dropTable(this.tableName)
  }
}
