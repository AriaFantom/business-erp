import { BaseSeeder } from '@adonisjs/lucid/seeders'
import AppSetting from '#models/app_setting'
import { ENABLED_MODULES_KEY } from '#services/modules/module_service'
import { MODULE_KEYS } from '#services/modules/registry'

export default class extends BaseSeeder {
  async run() {
    // Default to every module enabled so existing installs behave exactly as
    // before. Idempotent: only creates the row if it does not already exist, so
    // re-seeding never overwrites an admin's chosen configuration.
    const existing = await AppSetting.findBy('key', ENABLED_MODULES_KEY)
    if (existing) return

    await AppSetting.create({
      key: ENABLED_MODULES_KEY,
      value: [...MODULE_KEYS],
    })
  }
}
