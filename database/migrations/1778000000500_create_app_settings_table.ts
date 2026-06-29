import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'app_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Global, install-wide settings stored as a key → JSON value map. The
      // JSON payload is kept as text and (de)serialised in the model so any
      // shape (arrays, objects) round-trips cleanly on Postgres.
      table.string('key').notNullable().unique()
      table.text('value').notNullable().defaultTo('null')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
