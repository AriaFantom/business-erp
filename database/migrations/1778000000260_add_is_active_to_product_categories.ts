import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('product_categories', (table) => {
      table.boolean('is_active').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable('product_categories', (table) => {
      table.dropColumn('is_active')
    })
  }
}
