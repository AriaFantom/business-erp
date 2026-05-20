import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('printers', 'machines')
    this.schema.alterTable('production_jobs', (table) => {
      table.renameColumn('printer_id', 'machine_id')
    })
    this.schema.alterTable('expenses', (table) => {
      table.renameColumn('printer_id', 'machine_id')
    })

    this.schema.raw(`ALTER INDEX printers_current_job_uidx RENAME TO machines_current_job_uidx`)
    this.schema.raw(
      `ALTER INDEX production_jobs_active_printer_uidx RENAME TO production_jobs_active_machine_uidx`
    )

    this.schema.raw(`UPDATE purchase_items SET item_kind = 'machine' WHERE item_kind = 'printer'`)
    this.schema.raw(
      `ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_printer_qty_chk`
    )
    this.schema.raw(
      `ALTER TABLE purchase_items
       ADD CONSTRAINT purchase_items_machine_qty_chk
       CHECK (item_kind <> 'machine' OR (qty = floor(qty) AND qty >= 1))`
    )

    // ERP-generic operational status; 'printing' was 3D-print-specific.
    this.schema.raw(`UPDATE machines SET status = 'running' WHERE status = 'printing'`)
  }

  async down() {
    this.schema.raw(`UPDATE machines SET status = 'printing' WHERE status = 'running'`)

    this.schema.raw(
      `ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_machine_qty_chk`
    )
    this.schema.raw(`UPDATE purchase_items SET item_kind = 'printer' WHERE item_kind = 'machine'`)
    this.schema.raw(
      `ALTER TABLE purchase_items
       ADD CONSTRAINT purchase_items_printer_qty_chk
       CHECK (item_kind <> 'printer' OR (qty = floor(qty) AND qty >= 1))`
    )

    this.schema.raw(
      `ALTER INDEX production_jobs_active_machine_uidx RENAME TO production_jobs_active_printer_uidx`
    )
    this.schema.raw(`ALTER INDEX machines_current_job_uidx RENAME TO printers_current_job_uidx`)

    this.schema.alterTable('expenses', (table) => {
      table.renameColumn('machine_id', 'printer_id')
    })
    this.schema.alterTable('production_jobs', (table) => {
      table.renameColumn('machine_id', 'printer_id')
    })
    this.schema.renameTable('machines', 'printers')
  }
}
