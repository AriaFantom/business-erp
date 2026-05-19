import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('printer_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('printers')
        .onDelete('RESTRICT')
      table.integer('estimated_duration_min').nullable()
      table.timestamp('auto_complete_at', { useTz: true }).nullable()
      // current_stage_id FK is added in migration 340 once the stages table
      // exists. Defined here as a bare integer so the column already exists
      // when services start touching the row.
      table.integer('current_stage_id').unsigned().nullable()
      table.timestamp('paused_at', { useTz: true }).nullable()
      table.integer('remaining_seconds').nullable()
    })
    this.schema.raw(
      `CREATE UNIQUE INDEX production_jobs_active_printer_uidx
       ON production_jobs (printer_id)
       WHERE status IN ('in_progress', 'paused', 'awaiting_confirmation')`
    )
    this.schema.raw(
      `CREATE INDEX production_jobs_auto_complete_at_idx
       ON production_jobs (auto_complete_at)
       WHERE status = 'in_progress'`
    )
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS production_jobs_auto_complete_at_idx`)
    this.schema.raw(`DROP INDEX IF EXISTS production_jobs_active_printer_uidx`)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('remaining_seconds')
      table.dropColumn('paused_at')
      table.dropColumn('current_stage_id')
      table.dropColumn('auto_complete_at')
      table.dropColumn('estimated_duration_min')
      table.dropColumn('printer_id')
    })
  }
}
