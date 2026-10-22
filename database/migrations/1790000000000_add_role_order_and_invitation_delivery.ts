import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('roles', (table) => {
      table.integer('rank_position').notNullable().defaultTo(0)
      table.index('rank_position')
    })
    this.schema.alterTable('invitations', (table) => {
      table.string('delivery_status', 16).notNullable().defaultTo('unknown')
      table.timestamp('sent_at').nullable()
    })

    this.defer(async (db) => {
      const rows = (await db
        .from('roles')
        .select('id', 'name', 'display_name', 'parent_role_id')) as {
        id: number
        name: string
        display_name: string
        parent_role_id: number | null
      }[]
      const known = new Set(rows.map((row) => row.id))
      const sorted = [...rows].sort(
        (a, b) => a.display_name.localeCompare(b.display_name) || a.id - b.id
      )
      const visited = new Set<number>()
      const ordered: number[] = []
      const visit = (row: (typeof rows)[number]) => {
        if (visited.has(row.id)) return
        visited.add(row.id)
        ordered.push(row.id)
        for (const child of sorted.filter((item) => item.parent_role_id === row.id)) visit(child)
      }
      const owner = sorted.find((row) => row.name === 'owner')
      if (owner) visit(owner)
      for (const row of sorted.filter(
        (item) => item.parent_role_id === null || !known.has(item.parent_role_id)
      )) {
        visit(row)
      }
      for (const row of sorted) visit(row)
      for (const [position, id] of ordered.entries()) {
        await db.from('roles').where('id', id).update({ rank_position: position })
      }
    })
  }

  async down() {
    this.schema.alterTable('invitations', (table) => {
      table.dropColumn('delivery_status')
      table.dropColumn('sent_at')
    })
    this.schema.alterTable('roles', (table) => {
      table.dropIndex('rank_position')
      table.dropColumn('rank_position')
    })
  }
}
