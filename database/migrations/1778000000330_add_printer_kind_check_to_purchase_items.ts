import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      `ALTER TABLE purchase_items
       ADD CONSTRAINT purchase_items_printer_qty_chk
       CHECK (item_kind <> 'printer' OR (qty = floor(qty) AND qty >= 1))`
    )
  }

  async down() {
    this.schema.raw(
      `ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_printer_qty_chk`
    )
  }
}
