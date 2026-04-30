import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { storeAvatar, removeAvatar } from '#services/avatar_storage'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

/**
 * Build a minimal MultipartFile-like object whose `moveToDisk` writes
 * a fixed payload to the faked disk, matching the shape Vine returns.
 */
function fakeUpload(extname: 'png' | 'jpg', payload = 'fake-bytes'): MultipartFile {
  return {
    extname,
    clientName: `upload.${extname}`,
    moveToDisk: async (key: string) => {
      await drive.use().put(key, payload)
    },
  } as unknown as MultipartFile
}

test.group('avatar_storage', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('storeAvatar writes the file and sets avatarKey on the user', async ({ assert }) => {
    const user = await User.create({
      email: 'a@example.com',
      password: 'password123',
      firstName: 'A',
      lastName: 'B',
      isOwner: false,
    })

    await storeAvatar(user, fakeUpload('png'))

    assert.match(user.avatarKey ?? '', /^avatars\/[\w-]+\.png$/)
    assert.isTrue(await drive.use().exists(user.avatarKey!))
  })

  test('storeAvatar replaces an existing avatar and deletes the old key', async ({ assert }) => {
    const user = await User.create({
      email: 'b@example.com',
      password: 'password123',
      firstName: 'B',
      lastName: 'B',
      isOwner: false,
    })

    await storeAvatar(user, fakeUpload('png'))
    const firstKey = user.avatarKey!

    await storeAvatar(user, fakeUpload('jpg'))
    const secondKey = user.avatarKey!

    assert.notEqual(firstKey, secondKey)
    assert.match(secondKey, /\.jpg$/)
    assert.isFalse(await drive.use().exists(firstKey))
    assert.isTrue(await drive.use().exists(secondKey))
  })

  test('removeAvatar deletes the file and nulls avatarKey', async ({ assert }) => {
    const user = await User.create({
      email: 'c@example.com',
      password: 'password123',
      firstName: 'C',
      lastName: 'D',
      isOwner: false,
    })
    await storeAvatar(user, fakeUpload('png'))
    const key = user.avatarKey!

    await removeAvatar(user)

    assert.isNull(user.avatarKey)
    assert.isFalse(await drive.use().exists(key))
  })

  test('removeAvatar is a no-op when avatarKey is already null', async ({ assert }) => {
    const user = await User.create({
      email: 'd@example.com',
      password: 'password123',
      firstName: 'D',
      lastName: 'E',
      isOwner: false,
    })
    await removeAvatar(user)
    assert.isNull(user.avatarKey)
  })

  test('storeAvatar still updates avatarKey if deleting the old one fails', async ({ assert }) => {
    const user = await User.create({
      email: 'e@example.com',
      password: 'password123',
      firstName: 'E',
      lastName: 'F',
      isOwner: false,
    })
    user.avatarKey = 'avatars/never-existed.png'
    await user.save()

    await storeAvatar(user, fakeUpload('png'))
    assert.match(user.avatarKey, /^avatars\/[\w-]+\.png$/)
    assert.notEqual(user.avatarKey, 'avatars/never-existed.png')
  })
})
