import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { expireOverdueQuotations } from '#services/quotation_service'

/**
 * Nightly cron candidate. Flips `sent` quotations whose `valid_until` has
 * passed to `expired` so the UI doesn't keep them in the actionable list.
 */
export default class QuotationsExpire extends BaseCommand {
  static commandName = 'quotations:expire'
  static description = 'Mark sent quotations whose valid_until has passed as expired'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const count = await expireOverdueQuotations()
    this.logger.success(`Expired ${count} quotation(s).`)
  }
}
