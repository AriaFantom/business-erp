import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('job_expenses', 'expenses')
    this.schema.alterTable('expenses', (table) => {
      table.integer('job_id').unsigned().nullable().alter()
      table
        .integer('printer_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('printers')
        .onDelete('RESTRICT')
      table.index(['printer_id'])
    })
    this.schema.raw(
      `ALTER TABLE expenses
       ADD CONSTRAINT expenses_anchor_chk
       CHECK (job_id IS NOT NULL OR printer_id IS NOT NULL)`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_anchor_chk`)
    this.schema.alterTable('expenses', (table) => {
      table.dropIndex(['printer_id'])
      table.dropColumn('printer_id')
      table.integer('job_id').unsigned().notNullable().alter()
    })
    this.schema.renameTable('expenses', 'job_expenses')
  }
}
