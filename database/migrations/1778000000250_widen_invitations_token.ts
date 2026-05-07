import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Encrypted purpose-bound tokens (payload + iv + signature) are longer
    // than the original random(64) string, so widen the column.
    this.schema.alterTable('invitations', (table) => {
      table.string('token', 512).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable('invitations', (table) => {
      table.string('token', 128).notNullable().alter()
    })
  }
}
