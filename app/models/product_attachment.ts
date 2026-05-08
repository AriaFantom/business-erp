import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class ProductAttachment extends BaseModel {
  static table = 'product_attachments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare productId: number

  @column()
  declare fileKey: string

  @column()
  declare originalName: string

  @column()
  declare sizeBytes: number

  @column()
  declare mimeType: string | null

  @column()
  declare uploadedByUserId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
