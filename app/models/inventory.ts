import { InventorySchema } from '#database/schema'

export default class Inventory extends InventorySchema {
  static table = 'inventory'
}
