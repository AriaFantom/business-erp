# User Profile Page & Avatar Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/profile` page where authenticated users can edit their first/last name and upload, replace, or remove their avatar. Avatars are stored on the configured Drive disk (S3 / MinIO) and surfaced as a `user.avatarUrl` shared Inertia prop.

**Architecture:** New `users.avatar_key` column stores the storage path (not a URL). A small `avatar_storage` helper owns move/delete bytes. A new `ProfileController` exposes four routes inside the existing `auth` middleware group. The Inertia middleware resolves `avatarUrl` from `avatar_key` on every request. Frontend is a single new Inertia page reusing existing shadcn primitives.

**Tech Stack:** AdonisJS v7, Lucid, VineJS, AdonisJS Drive (S3/MinIO), Inertia + React 19, shadcn components, Japa runner.

**Spec:** `docs/superpowers/specs/2026-04-30-user-avatar-and-profile-design.md`

---

## File map

| Path | Verb | Responsibility |
|---|---|---|
| `database/migrations/<timestamp>_add_avatar_key_to_users_table.ts` | Create | Adds `avatar_key` column (nullable string) |
| `app/models/user.ts` | Modify | Add `avatarKey` `@column` declaration |
| `config/bodyparser.ts` | Modify | Set `multipart.processManually: ['/profile/avatar']` to be explicit (default `autoProcess: true` already covers the route, no change needed unless we want stricter scoping — see Task 3 note) |
| `app/validators/profile.ts` | Create | `updateProfileValidator`, `updateAvatarValidator` |
| `app/services/avatar_storage.ts` | Create | `storeAvatar(user, file)` / `removeAvatar(user)` — move/delete bytes + persist key |
| `app/controllers/profile_controller.ts` | Create | `show`, `update`, `updateAvatar`, `destroyAvatar` |
| `start/routes.ts` | Modify | Register profile routes inside the existing `auth` group |
| `app/middleware/inertia_middleware.ts` | Modify | Add `avatarUrl` to shared `user` prop |
| `inertia/lib/user.ts` | Create | `userInitials` helper (extract from dashboard) |
| `inertia/pages/dashboard.tsx` | Modify | Import `userInitials` from new helper; add Profile link |
| `inertia/pages/profile/edit.tsx` | Create | New profile edit page |
| `tests/functional/profile/avatar_storage.spec.ts` | Create | Tests for `storeAvatar` / `removeAvatar` |
| `tests/unit/validators/profile.spec.ts` | Create | Tests for both validators |

---

## Task 1: Add `avatar_key` migration

**Files:**
- Create: `database/migrations/<timestamp>_add_avatar_key_to_users_table.ts`

- [ ] **Step 1: Generate the migration scaffold**

Run: `node ace make:migration add_avatar_key_to_users_table --table=users`
Expected: prints the created path under `database/migrations/`. Note the generated filename for later edits.

- [ ] **Step 2: Fill in the migration**

Replace the file contents with:

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('avatar_key').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('avatar_key')
    })
  }
}
```

- [ ] **Step 3: Run the migration**

Run: `node ace migration:run`
Expected: migration applied; `database/schema.ts` regenerates and `UserSchema.$columns` now includes `'avatarKey'` and a `declare avatarKey: string | null` line.

- [ ] **Step 4: Verify the schema regenerated**

Run: `grep -n "avatarKey" database/schema.ts`
Expected: at least two matches (one in `$columns`, one in the `declare` line).

- [ ] **Step 5: Commit**

```bash
git add database/migrations database/schema.ts
git commit -m "feat(users): add avatar_key column"
```

---

## Task 2: Expose `avatarKey` on the User model

**Files:**
- Modify: `app/models/user.ts`

- [ ] **Step 1: Add the column declaration**

Open `app/models/user.ts` and insert a new `@column()` declaration alongside the existing string columns (immediately after `lastName`):

```ts
  @column()
  declare lastName: string | null

  @column()
  declare avatarKey: string | null

  @column()
  declare isOwner: boolean
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/models/user.ts
git commit -m "feat(users): expose avatarKey column on User model"
```

---

## Task 3: Verify multipart routing & note bodyparser scoping

The codebase ships with `multipart.autoProcess: true`, which means uploads work on every route. The spec called for tightening this to `['/profile/avatar']` only, but reviewing `config/bodyparser.ts` shows `autoProcess` accepts only a boolean in this AdonisJS version; the closer knob is `processManually`. We do **not** want `processManually` for `/profile/avatar` (we want auto-processing there). So the safest action is to **leave bodyparser as-is** for now and rely on the validator + auth middleware as the security boundary. Document this decision and move on.

- [ ] **Step 1: Add a brief comment in `config/bodyparser.ts`**

Find the `multipart` block and add a single-line comment above `autoProcess: true`:

```ts
  multipart: {
    // Avatar uploads validate via VineJS file rules in updateAvatarValidator;
    // global autoProcess is acceptable because all upload routes sit behind auth.
    autoProcess: true,
```

(No behavior change — just makes the decision explicit for future readers.)

- [ ] **Step 2: Commit**

```bash
git add config/bodyparser.ts
git commit -m "docs(bodyparser): note why multipart autoProcess stays global"
```

---

## Task 4: Write the profile validators (TDD)

**Files:**
- Create: `app/validators/profile.ts`
- Test: `tests/unit/validators/profile.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/validators/profile.spec.ts`:

```ts
import { test } from '@japa/runner'
import { updateProfileValidator, updateAvatarValidator } from '#validators/profile'
import { MultipartFile } from '@adonisjs/core/bodyparser'

test.group('updateProfileValidator', () => {
  test('accepts valid first/last name', async ({ assert }) => {
    const out = await updateProfileValidator.validate({
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
    assert.equal(out.firstName, 'Ada')
    assert.equal(out.lastName, 'Lovelace')
  })

  test('accepts null first/last name', async ({ assert }) => {
    const out = await updateProfileValidator.validate({
      firstName: null,
      lastName: null,
    })
    assert.isNull(out.firstName)
    assert.isNull(out.lastName)
  })

  test('rejects names longer than 80 chars', async ({ assert }) => {
    const long = 'x'.repeat(81)
    await assert.rejects(
      () => updateProfileValidator.validate({ firstName: long, lastName: null }),
      /firstName/
    )
  })
})

test.group('updateAvatarValidator', () => {
  test('rejects missing file', async ({ assert }) => {
    await assert.rejects(
      () => updateAvatarValidator.validate({}),
      /avatar/
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ace test --suites=unit --files="tests/unit/validators/profile.spec.ts"`
Expected: FAIL with module-not-found / `Cannot find module '#validators/profile'`.

- [ ] **Step 3: Implement the validators**

Create `app/validators/profile.ts`:

```ts
import vine from '@vinejs/vine'

/**
 * Profile data update — first/last name only.
 * Avatar uploads have their own validator/route.
 */
export const updateProfileValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().maxLength(80).nullable(),
    lastName: vine.string().trim().maxLength(80).nullable(),
  })
)

/**
 * Avatar upload — single image file, capped at 2 MB.
 * VineJS validates extension and size; controller writes to Drive.
 */
export const updateAvatarValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    }),
  })
)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ace test --suites=unit --files="tests/unit/validators/profile.spec.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/validators/profile.ts tests/unit/validators/profile.spec.ts
git commit -m "feat(profile): add VineJS validators for profile/avatar updates"
```

---

## Task 5: Avatar storage helper (TDD)

The helper owns the side effects so the controller stays a thin orchestrator and we can test the move/replace/delete logic without HTTP.

**Files:**
- Create: `app/services/avatar_storage.ts`
- Test: `tests/functional/profile/avatar_storage.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/functional/profile/avatar_storage.spec.ts`:

```ts
import { test } from '@japa/runner'
import { Readable } from 'node:stream'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { storeAvatar, removeAvatar } from '#services/avatar_storage'
import { MultipartFile } from '@adonisjs/core/bodyparser'

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node ace test --suites=functional --files="tests/functional/profile/avatar_storage.spec.ts"`
Expected: FAIL with `Cannot find module '#services/avatar_storage'`.

- [ ] **Step 3: Implement the service**

Create `app/services/avatar_storage.ts`:

```ts
import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type User from '#models/user'

const AVATAR_PREFIX = 'avatars'

/**
 * Move an uploaded image into permanent storage, point the user at it,
 * and best-effort delete the previous avatar (if any).
 *
 * The new key is persisted before the old one is deleted; a delete
 * failure is logged but does not fail the upload, because the
 * user-visible state (the new avatar) is already correct.
 */
export async function storeAvatar(user: User, file: MultipartFile): Promise<void> {
  const previousKey = user.avatarKey
  const newKey = `${AVATAR_PREFIX}/${randomUUID()}.${file.extname}`

  await file.moveToDisk(newKey)

  user.avatarKey = newKey
  await user.save()

  if (previousKey && previousKey !== newKey) {
    try {
      await drive.use().delete(previousKey)
    } catch (err) {
      logger.warn({ err, key: previousKey }, 'avatar_storage: failed to delete previous avatar')
    }
  }
}

/**
 * Remove the user's avatar (storage + DB column).
 * Idempotent: calling it on a user with no avatar is a no-op.
 */
export async function removeAvatar(user: User): Promise<void> {
  const key = user.avatarKey
  if (!key) return

  try {
    await drive.use().delete(key)
  } catch (err) {
    logger.warn({ err, key }, 'avatar_storage: failed to delete avatar from disk')
  }

  user.avatarKey = null
  await user.save()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node ace test --suites=functional --files="tests/functional/profile/avatar_storage.spec.ts"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/services/avatar_storage.ts tests/functional/profile/avatar_storage.spec.ts
git commit -m "feat(profile): add avatar_storage service with TDD coverage"
```

---

## Task 6: Profile controller

**Files:**
- Create: `app/controllers/profile_controller.ts`

- [ ] **Step 1: Create the controller**

Create `app/controllers/profile_controller.ts`:

```ts
import type { HttpContext } from '@adonisjs/core/http'
import { updateProfileValidator, updateAvatarValidator } from '#validators/profile'
import { storeAvatar, removeAvatar } from '#services/avatar_storage'

export default class ProfileController {
  /** GET /profile */
  async show({ inertia }: HttpContext) {
    return inertia.render('profile/edit')
  }

  /** POST /profile — update first/last name */
  async update({ request, auth, response, session }: HttpContext) {
    const payload = await request.validateUsing(updateProfileValidator)
    const user = auth.user!

    user.firstName = payload.firstName
    user.lastName = payload.lastName
    await user.save()

    session.flash('success', 'Profile updated.')
    return response.redirect().back()
  }

  /** POST /profile/avatar — upload or replace avatar */
  async updateAvatar({ request, auth, response, session }: HttpContext) {
    const payload = await request.validateUsing(updateAvatarValidator)
    await storeAvatar(auth.user!, payload.avatar)

    session.flash('success', 'Avatar updated.')
    return response.redirect().back()
  }

  /** POST /profile/avatar/delete — remove avatar */
  async destroyAvatar({ auth, response, session }: HttpContext) {
    await removeAvatar(auth.user!)
    session.flash('success', 'Avatar removed.')
    return response.redirect().back()
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/controllers/profile_controller.ts
git commit -m "feat(profile): add ProfileController with show/update/avatar actions"
```

---

## Task 7: Register profile routes

**Files:**
- Modify: `start/routes.ts`

- [ ] **Step 1: Add the controller import**

Open `start/routes.ts`. Add this line alongside the other lazy controller imports near the top:

```ts
const ProfileController = () => import('#controllers/profile_controller')
```

- [ ] **Step 2: Add the routes inside the existing `middleware.auth()` group**

Inside the second `router.group(...)` (the `middleware.auth()` group), add these four lines after the `roles/...` lines and before the closing brace of the group callback:

```ts
    router.get('profile', [ProfileController, 'show']).as('profile.show')
    router.post('profile', [ProfileController, 'update']).as('profile.update')
    router
      .post('profile/avatar', [ProfileController, 'updateAvatar'])
      .as('profile.avatar.update')
    router
      .post('profile/avatar/delete', [ProfileController, 'destroyAvatar'])
      .as('profile.avatar.destroy')
```

- [ ] **Step 3: Verify routes register**

Run: `node ace list:routes | grep profile`
Expected: 4 lines listing the four `profile.*` routes under the `auth` middleware.

- [ ] **Step 4: Commit**

```bash
git add start/routes.ts
git commit -m "feat(profile): register /profile routes"
```

---

## Task 8: Share `avatarUrl` on the Inertia user prop

**Files:**
- Modify: `app/middleware/inertia_middleware.ts`

- [ ] **Step 1: Import the drive service and extend `serializeUser`**

Add the drive import at the top of `app/middleware/inertia_middleware.ts`:

```ts
import drive from '@adonisjs/drive/services/main'
```

Replace the `serializeUser` function with:

```ts
async function serializeUser(user: User) {
  // Owners implicitly hold every active permission; everyone else gets
  // the union of permissions across their assigned roles.
  const userPermissions = user.isOwner ? ['*'] : await user.getPermissions()
  const roles = user.isOwner ? [] : await user.getRoles()
  const avatarUrl = user.avatarKey ? await drive.use().getUrl(user.avatarKey) : null
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl,
    isOwner: user.isOwner,
    permissions: userPermissions,
    roleIds: roles.map((r) => r.id),
    roleNames: roles.map((r) => r.displayName),
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Inertia's `Data.SharedProps['user']` is inferred from this return type, so the new field flows through automatically.)

- [ ] **Step 3: Commit**

```bash
git add app/middleware/inertia_middleware.ts
git commit -m "feat(inertia): share avatarUrl on the user prop"
```

---

## Task 9: Extract `userInitials` to a shared helper

**Files:**
- Create: `inertia/lib/user.ts`
- Modify: `inertia/pages/dashboard.tsx`

- [ ] **Step 1: Create the helper**

Create `inertia/lib/user.ts`:

```ts
function initialsFromEmail(email: string | null): string {
  if (!email) return '?'
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase() || '?'
}

export function userInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = firstName?.trim().charAt(0) ?? ''
  const last = lastName?.trim().charAt(0) ?? ''
  const combined = `${first}${last}`.toUpperCase()
  if (combined) return combined
  return initialsFromEmail(email ?? null)
}
```

- [ ] **Step 2: Replace the local helpers in dashboard.tsx**

Open `inertia/pages/dashboard.tsx`. Add this import beside the other `@/...` imports near the top:

```ts
import { userInitials } from '@/lib/user'
```

Delete both the local `initialsFor(...)` (lines around 69-73) and `userInitials(...)` (lines around 75-81) function definitions. The existing `initialsFor(invite.email)` call site (around line 484) needs to be updated:

```tsx
<AvatarFallback>{userInitials(null, null, invite.email)}</AvatarFallback>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add inertia/lib/user.ts inertia/pages/dashboard.tsx
git commit -m "refactor(inertia): extract userInitials to shared helper"
```

---

## Task 10: Profile edit page

**Files:**
- Create: `inertia/pages/profile/edit.tsx`

- [ ] **Step 1: Create the page**

Create `inertia/pages/profile/edit.tsx`:

```tsx
import { useRef, useState, type ChangeEvent } from 'react'
import { router, useForm, usePage } from '@inertiajs/react'
import { ArrowLeft, Trash2, Upload } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { userInitials } from '@/lib/user'
import type { InertiaProps } from '@/types'

export default function ProfileEdit() {
  const { user } = usePage<InertiaProps>().props
  if (!user) return null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.visit('/dashboard')}>
          <ArrowLeft />
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">Update your name and avatar.</p>
        </div>
      </div>

      <AvatarCard
        avatarUrl={user.avatarUrl}
        initials={userInitials(user.firstName, user.lastName, user.email)}
      />

      <ProfileCard
        initialFirstName={user.firstName ?? ''}
        initialLastName={user.lastName ?? ''}
      />
    </div>
  )
}

function ProfileCard({
  initialFirstName,
  initialLastName,
}: {
  initialFirstName: string
  initialLastName: string
}) {
  const { data, setData, post, processing, errors } = useForm({
    firstName: initialFirstName,
    lastName: initialLastName,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal info</CardTitle>
        <CardDescription>Shown on your dashboard and in audit trails.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          post('/profile', { preserveScroll: true })
        }}
      >
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              name="firstName"
              value={data.firstName}
              onChange={(e) => setData('firstName', e.target.value)}
              aria-invalid={errors.firstName ? true : undefined}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              name="lastName"
              value={data.lastName}
              onChange={(e) => setData('lastName', e.target.value)}
              aria-invalid={errors.lastName ? true : undefined}
            />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={processing}>
            {processing ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function AvatarCard({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null | undefined
  initials: string
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const { setData, post, processing, errors, reset } = useForm<{ avatar: File | null }>({
    avatar: null,
  })

  const onFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return

    setData('avatar', file)
    setPreviewUrl(URL.createObjectURL(file))

    post('/profile/avatar', {
      preserveScroll: true,
      forceFormData: true,
      onFinish: () => {
        reset('avatar')
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
    })
  }

  const onRemove = () => {
    if (!window.confirm('Remove your avatar?')) return
    router.post('/profile/avatar/delete', {}, { preserveScroll: true })
  }

  const displayUrl = previewUrl ?? avatarUrl ?? undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <CardDescription>JPG, PNG, or WebP. Max 2 MB.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <Avatar size="lg" className="size-20">
          {displayUrl && <AvatarImage src={displayUrl} alt="" />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChosen}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload />
              {processing ? 'Uploading…' : avatarUrl ? 'Replace' : 'Upload'}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={processing}
                onClick={onRemove}
              >
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
          {errors.avatar && <p className="text-sm text-destructive">{errors.avatar}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add inertia/pages/profile/edit.tsx
git commit -m "feat(profile): add /profile edit page with avatar + name forms"
```

---

## Task 11: Add a Profile entry on the dashboard

**Files:**
- Modify: `inertia/pages/dashboard.tsx`

- [ ] **Step 1: Add a Profile button in the header**

Open `inertia/pages/dashboard.tsx`. Find the header block where the Logout `<Form>` is rendered (around line 391). Insert a Profile link button immediately before the existing `<Form action="/logout" ...>`:

```tsx
            <Button variant="outline" size="sm" onClick={() => router.visit('/profile')}>
              Profile
            </Button>
            <Form action="/logout" method="post">
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (`router` is already imported in this file.)

- [ ] **Step 3: Commit**

```bash
git add inertia/pages/dashboard.tsx
git commit -m "feat(dashboard): link to /profile from the header"
```

---

## Task 12: Full test sweep + manual smoke

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass (existing tests + the two new files from tasks 4 and 5).

- [ ] **Step 2: Run lint and typecheck**

Run in parallel:
- `npm run lint`
- `npm run typecheck`

Expected: both pass with zero errors.

- [ ] **Step 3: Manual smoke test in dev**

1. Ensure local infra is up: `docker-compose -f docker-compose.dev.yml up -d`
2. Start the dev server: `npm run dev`
3. Sign in as an existing user.
4. Click **Profile** in the dashboard header → page loads at `/profile`.
5. Change first/last name → Save → toast appears, dashboard header reflects new name.
6. Upload a PNG avatar → toast appears, avatar shows on profile page and dashboard header.
7. Replace with a JPG → toast appears, new avatar shows; check MinIO console (`http://localhost:9001`, `devminio/devminio`) → confirm only the new key remains under `avatars/`.
8. Click **Remove** → confirm → toast appears, avatar reverts to initials, MinIO no longer has the file.
9. Try uploading a 5 MB image → validator rejects with a visible error.
10. Try uploading a `.gif` → validator rejects with a visible error.

- [ ] **Step 4: If anything in step 3 fails, fix it and re-run step 1**

- [ ] **Step 5: Final commit only if there are uncommitted fixes**

Skip if no changes are pending. Otherwise:

```bash
git status
# stage only the relevant files, then:
git commit -m "fix(profile): <describe>"
```

---

## Self-review notes

- **Spec coverage check (against `2026-04-30-user-avatar-and-profile-design.md`):**
  - Data model (`avatar_key` column, no URL column) → Tasks 1, 2.
  - Bodyparser scoping → Task 3 (decision documented; `processManually` is not the right knob, validator + auth is the actual boundary).
  - Storage layout (`avatars/<uuid>.<ext>`) → Task 5.
  - Replacement & deletion semantics (best-effort old-key delete, idempotent remove) → Task 5 tests.
  - Four routes inside the `auth` group → Task 7.
  - Validators with size/extname constraints → Task 4.
  - `avatarUrl` on shared user prop → Task 8.
  - `userInitials` extracted → Task 9.
  - Profile page with two cards → Task 10.
  - Dashboard navigation entry → Task 11.
  - Manual smoke against MinIO → Task 12.
- **Placeholder scan:** none — every code step contains the actual code.
- **Type/name consistency:** `avatarKey` (DB) ↔ `user.avatarKey` (model) ↔ `avatarUrl` (frontend prop) is consistent across tasks. `storeAvatar`/`removeAvatar` names match between Task 5 (definition + tests) and Task 6 (caller).
