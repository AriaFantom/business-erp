import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('parent_role_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('roles')
        .onDelete('SET NULL')
      table.index('parent_role_id')
    })

    this.defer(async (db) => {
      // Backfill the tree from the existing flat priority ordering:
      // each role gets the next-higher-priority role as its parent. This
      // turns owner > admin > member (and any custom roles in between)
      // into a single chain, which preserves who-can-assign-whom semantics.
      await db.rawQuery(`
        WITH ordered AS (
          SELECT id,
                 ROW_NUMBER() OVER (ORDER BY priority DESC, id ASC) AS rn
          FROM roles
        )
        UPDATE roles AS r
        SET parent_role_id = parent.id
        FROM ordered AS child
        JOIN ordered AS parent ON parent.rn = child.rn - 1
        WHERE r.id = child.id
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['parent_role_id'])
      table.dropColumn('parent_role_id')
    })
  }
}
