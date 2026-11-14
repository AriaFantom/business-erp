import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('purchase_items', (table) => {
      table.decimal('qty', 20, 9).notNullable().alter()
      table.jsonb('measurement_snapshot').nullable()
    })
    this.schema.alterTable('purchase_return_items', (table) => {
      table.decimal('qty', 20, 9).notNullable().alter()
    })
  }

  async down() {
    throw new Error('Do not discard purchase unit snapshots or shrink saved quantity precision.')
  }
}
