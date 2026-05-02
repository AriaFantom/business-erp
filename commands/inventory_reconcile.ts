import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { reconcileInventory } from '#services/reports_service'

/**
 * Reconciliation guard: replays stock_movements per item and verifies the
 * sum equals inventory.qty. Surface divergence loudly so a regression in
 * any service that bypasses applyMovement is caught.
 */
export default class InventoryReconcile extends BaseCommand {
  static commandName = 'inventory:reconcile'
  static description = 'Verify inventory.qty matches the sum of stock_movements per item'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const result = await reconcileInventory()
    if (result.ok) {
      this.logger.success('Inventory reconciliation OK — no divergence detected.')
      return
    }
    this.logger.error(`Inventory divergence found in ${result.divergent.length} item(s):`)
    for (const d of result.divergent) {
      this.logger.error(
        `  ${d.itemKind}#${d.itemId}: on-hand=${d.onHand}, movements=${d.sumOfMovements}, diff=${d.diff}`
      )
    }
    this.exitCode = 1
  }
}
