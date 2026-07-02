import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_recipes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Learned recipes are versioned: completing a job writes a NEW version
      // instead of destructively rewriting the rows. Readers filter on
      // is_current; history stays queryable via learned_from_job_id.
      table.integer('version').unsigned().notNullable().defaultTo(1)
      table.boolean('is_current').notNullable().defaultTo(true)
      table.dropUnique(['product_id', 'item_kind', 'item_id'])
      table.unique(['product_id', 'item_kind', 'item_id', 'version'])
      table.index(['product_id', 'is_current'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['product_id', 'is_current'])
      table.dropUnique(['product_id', 'item_kind', 'item_id', 'version'])
      table.unique(['product_id', 'item_kind', 'item_id'])
      table.dropColumn('version')
      table.dropColumn('is_current')
    })
  }
}
