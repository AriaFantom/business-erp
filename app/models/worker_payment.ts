import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { WorkerPaymentSchema } from '#database/schema'
import User from '#models/user'
import Worker from '#models/worker'

export default class WorkerPayment extends WorkerPaymentSchema {
  @belongsTo(() => Worker, { foreignKey: 'workerId' })
  declare worker: BelongsTo<typeof Worker>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
