// app/models/user.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import hash from '@adonisjs/core/services/hash'
import { withRoles } from '#mixins/with_roles'
import Role from '#models/role'
import { DateTime } from 'luxon'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(
  BaseModel,
  AuthFinder,
  withRoles({ roleModel: () => Role, pivotTable: 'user_roles' })
) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare firstName: string | null

  @column()
  declare lastName: string | null

  @column()
  declare avatarKey: string | null

  @column()
  declare isOwner: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
