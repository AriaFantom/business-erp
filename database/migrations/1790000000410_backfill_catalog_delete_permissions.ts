import { BaseSchema } from '@adonisjs/lucid/schema'

const DELETE_PERMISSIONS = [
  'materials.delete',
  'components.delete',
  'products.delete',
  'machines.delete',
]

export default class extends BaseSchema {
  async up() {
    for (const permission of DELETE_PERMISSIONS) {
      const encoded = JSON.stringify([permission])
      this.schema.raw(`UPDATE roles
         SET permissions = (COALESCE(NULLIF(permissions, ''), '[]')::jsonb || '${encoded}'::jsonb)::text,
             updated_at = NOW()
         WHERE is_system = true
           AND name IN ('owner', 'admin')
           AND NOT jsonb_exists(
             COALESCE(NULLIF(permissions, ''), '[]')::jsonb,
             '${permission}'
           )`)
    }
  }

  async down() {
    for (const permission of DELETE_PERMISSIONS) {
      this.schema.raw(`UPDATE roles
         SET permissions = COALESCE(
           (SELECT jsonb_agg(value)::text
            FROM jsonb_array_elements_text(COALESCE(NULLIF(roles.permissions, ''), '[]')::jsonb) value
            WHERE value <> '${permission}'),
           '[]'
         ),
         updated_at = NOW()
         WHERE is_system = true AND name IN ('owner', 'admin')`)
    }
  }
}
