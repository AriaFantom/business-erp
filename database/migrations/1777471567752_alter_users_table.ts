import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('first_name').nullable()
      table.string('last_name').nullable()
      table.boolean('is_owner').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('first_name', 'last_name', 'is_owner')
    })
  }
}
