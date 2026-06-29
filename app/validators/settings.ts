import vine from '@vinejs/vine'
import { MODULE_KEYS } from '#services/modules/registry'

export const updateModulesValidator = vine.compile(
  vine.object({
    enabledModules: vine.array(vine.enum(MODULE_KEYS)).distinct(),
  })
)
