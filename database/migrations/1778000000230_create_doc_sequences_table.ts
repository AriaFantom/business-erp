import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Per-(scope, year) gapless counter for human-friendly document numbers
 * (INV-2026-000123, QT-2026-000045, etc.). The numbering service does an
 * UPDATE … RETURNING last_number+1 in the same transaction as the insert it
 * is numbering, so the counter stays gapless and concurrent inserts serialise
 * on the row lock.
 */
export default class extends BaseSchema {
  protected tableName = 'doc_sequences'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // 'INV', 'QT', 'PO', 'JOB', 'SO', etc.
      table.string('scope').notNullable()
      table.integer('year').notNullable()
      table.bigInteger('last_number').notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.unique(['scope', 'year'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
