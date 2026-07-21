import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The enabled-module set is stored as a single row, written once by the
 * seeder. Installs created before the Labour module existed therefore have it
 * missing — which reads as "disabled" — even though the default is that every
 * module is on. Append it so upgrades behave like fresh installs.
 */
export default class extends BaseSchema {
  async up() {
    const rows = await this.db.from('app_settings').where('key', 'enabled_modules').select('value')
    const row = rows[0]
    if (!row) return

    const current: unknown = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
    if (!Array.isArray(current)) return
    if (current.includes('labour')) return

    // Keep it next to its sibling manufacturing module for readability.
    const next = [...current]
    const at = next.indexOf('machines')
    if (at === -1) next.push('labour')
    else next.splice(at + 1, 0, 'labour')

    await this.db
      .from('app_settings')
      .where('key', 'enabled_modules')
      .update({ value: JSON.stringify(next), updated_at: new Date() })
  }

  async down() {
    const rows = await this.db.from('app_settings').where('key', 'enabled_modules').select('value')
    const row = rows[0]
    if (!row) return

    const current: unknown = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
    if (!Array.isArray(current)) return

    await this.db
      .from('app_settings')
      .where('key', 'enabled_modules')
      .update({
        value: JSON.stringify(current.filter((k) => k !== 'labour')),
        updated_at: new Date(),
      })
  }
}
