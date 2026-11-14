import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    for (const name of ['quotation_items', 'order_items', 'invoice_items']) {
      this.schema.alterTable(name, (table) => table.jsonb('measurement_snapshot').nullable())
    }
  }

  async down() {
    throw new Error('Do not discard sales unit snapshots.')
  }
}
