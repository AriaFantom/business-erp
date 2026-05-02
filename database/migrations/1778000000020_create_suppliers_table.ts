import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('gstin').nullable()
      table.string('email').nullable()
      table.string('phone').nullable()
      table.text('address').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamps(true, true)
      table.index(['is_active'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
