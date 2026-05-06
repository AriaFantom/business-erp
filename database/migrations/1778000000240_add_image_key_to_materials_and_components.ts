import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('materials', (table) => {
      table.string('image_key').nullable()
    })
    this.schema.alterTable('components', (table) => {
      table.string('image_key').nullable()
    })
  }

  async down() {
    this.schema.alterTable('materials', (table) => {
      table.dropColumn('image_key')
    })
    this.schema.alterTable('components', (table) => {
      table.dropColumn('image_key')
    })
  }
}
