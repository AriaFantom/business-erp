import { BaseSeeder } from '@adonisjs/lucid/seeders'
import AppSetting from '#models/app_setting'
import Role from '#models/role'
import { MODULE_KEYS } from '#services/modules/registry'
import { ENABLED_MODULES_KEY } from '#services/modules/module_service'

/**
 * Additive-only data upgrades for an existing production installation.
 *
 * The deployment pipeline runs this file instead of every seeder so catalog
 * defaults and operator customizations are never reset during an upgrade.
 * Keep every operation idempotent and never delete or replace business data.
 */
export default class ProductionUpgradeSeeder extends BaseSeeder {
  async run() {
    const setting = await AppSetting.findBy('key', ENABLED_MODULES_KEY)
    if (!setting) {
      await AppSetting.create({
        key: ENABLED_MODULES_KEY,
        value: [...MODULE_KEYS],
      })
    }

    // Preserve existing permissions and add only the capabilities introduced
    // with module management and labour. Custom roles remain untouched.
    const additions: Record<string, string[]> = {
      owner: [
        'workers.view',
        'workers.create',
        'workers.update',
        'workers.retire',
        'workers.pay',
        'settings.view',
        'settings.manageModules',
      ],
      admin: [
        'workers.view',
        'workers.create',
        'workers.update',
        'workers.retire',
        'workers.pay',
        'settings.view',
        'settings.manageModules',
      ],
      member: ['workers.view'],
    }

    for (const [name, keys] of Object.entries(additions)) {
      const role = await Role.findBy('name', name)
      if (role?.isSystem) await role.givePermissions(keys)
    }
  }
}
