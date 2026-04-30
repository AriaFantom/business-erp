# User Profile Page & Avatar Upload — Design

**Date:** 2026-04-30
**Status:** Approved (pending user review of this written spec)

## Goal

Give every authenticated user a `/profile` page where they can:

1. Update their `firstName` and `lastName`.
2. Upload, replace, or delete their avatar.

Use the AdonisJS-recommended file-upload flow (VineJS `vine.file()` validator + `moveToDisk`) and let Drive (S3 / MinIO in dev, public visibility) own the bytes.

## Non-goals

- Email change, password change, account deletion. Out of scope; the page is structured so they can be added later without rework.
- Image cropping / resizing. The browser receives the raw uploaded image.
- Public profile pages for other users. Self-service only.

## Architecture

### Data model

New migration `add_avatar_key_to_users_table.ts` adds one column:

| Column | Type | Notes |
|---|---|---|
| `avatar_key` | `string`, nullable | Storage path on the configured Drive disk, e.g. `avatars/<uuid>.png`. **Not** a URL. |

Why store the key, not the URL: the disk's bucket / endpoint / CDN can change without a backfill. URLs are produced on read.

After running `node ace migration:run`, `database/schema.ts` regenerates with `avatarKey` on `UserSchema` automatically. The `User` model gets a corresponding `@column() declare avatarKey: string | null`.

### Bodyparser scoping

`config/bodyparser.ts` adds `multipart.autoProcess: ['/profile/avatar']` so multipart parsing only fires on the avatar route. Matches the security guidance in the AdonisJS docs.

### Storage layout

- Disk: default (`s3` in this project; MinIO locally).
- Path: `avatars/<uuid>.<ext>` where the UUID comes from `@adonisjs/core/helpers`'s `string.uuid()`. UUID-keyed paths avoid leaking PII and prevent replacement collisions.
- Visibility: public (already configured in `config/drive.ts`); URLs are produced via `drive.use().getUrl(key)`.

### Replacement & deletion semantics

- **Upload when `avatar_key` is null:** `moveToDisk` → set `avatar_key`.
- **Upload when `avatar_key` is set:** `moveToDisk` the new file → update `avatar_key` → best-effort `drive.use().delete(oldKey)`. A delete failure is logged but not fatal; the new upload is what the user sees.
- **Delete:** `drive.use().delete(currentKey)` → null the column. If the file is missing on disk we still null the column (idempotent).

## HTTP surface

All routes sit inside the existing `middleware.auth()` group in `start/routes.ts`.

| Method | Route | Controller action | Body |
|---|---|---|---|
| GET | `/profile` | `ProfileController.show` | — |
| POST | `/profile` | `ProfileController.update` | `firstName`, `lastName` (JSON-ish form) |
| POST | `/profile/avatar` | `ProfileController.updateAvatar` | multipart `avatar` |
| POST | `/profile/avatar/delete` | `ProfileController.destroyAvatar` | — |

`POST /profile/avatar/delete` (rather than `DELETE`) matches the project convention (`roles/:id/delete`, `invitations/:id/revoke`).

## Backend implementation

### `app/controllers/profile_controller.ts`

- `show(ctx)` — `inertia.render('profile/edit')`. The shared `user` prop already carries everything the page needs.
- `update(ctx)` — `request.validateUsing(updateProfileValidator)` → assign and `save()` the authenticated user → flash success → redirect back.
- `updateAvatar(ctx)` — `request.validateUsing(updateAvatarValidator)` → generate UUID filename with the uploaded file's `extname` → `payload.avatar.moveToDisk(\`avatars/${uuid}.${extname}\`)` → if `user.avatarKey` was set, best-effort delete it → assign new key → save → flash → redirect back.
- `destroyAvatar(ctx)` — if `user.avatarKey` is set, best-effort `drive.use().delete(user.avatarKey)` → null the column → save → flash → redirect back.

### `app/validators/profile.ts`

```ts
export const updateProfileValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().maxLength(80).nullable(),
    lastName:  vine.string().trim().maxLength(80).nullable(),
  })
)

export const updateAvatarValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    }),
  })
)
```

### Routes (`start/routes.ts`)

Add inside the existing `middleware.auth()` group:

```ts
router.get('profile',                  [ProfileController, 'show']).as('profile.show')
router.post('profile',                 [ProfileController, 'update']).as('profile.update')
router.post('profile/avatar',          [ProfileController, 'updateAvatar']).as('profile.avatar.update')
router.post('profile/avatar/delete',   [ProfileController, 'destroyAvatar']).as('profile.avatar.destroy')
```

### Shared Inertia prop change (`app/middleware/inertia_middleware.ts`)

Extend `serializeUser`:

```ts
const avatarUrl = user.avatarKey ? await drive.use().getUrl(user.avatarKey) : null
return { …existing fields, avatarUrl }
```

`avatarUrl` becomes part of `Data.SharedProps['user']` automatically because the middleware's return type is inferred.

## Frontend

### Page: `inertia/pages/profile/edit.tsx`

Two stacked cards inside the default layout. Both use existing shadcn primitives.

**Profile card**
- `firstName`, `lastName` inputs preloaded from `usePage().props.user`.
- Single Save button — `useForm` posts to `/profile`.
- Inline error rendering (matches existing dashboard patterns).

**Avatar card**
- Large shadcn `<Avatar>`: `<AvatarImage src={user.avatarUrl}>` when set, else `<AvatarFallback>{userInitials(...)}</AvatarFallback>`.
- "Upload new" button → triggers a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`. On change: store the `File` in `useForm`, show a local preview via `URL.createObjectURL`, and POST as multipart to `/profile/avatar`.
- "Remove" button — visible only when `user.avatarUrl` is set. Confirms with `window.confirm`, then POSTs to `/profile/avatar/delete`.

### Shared helper

Extract `userInitials` (currently in `inertia/pages/dashboard.tsx`) into `inertia/lib/user.ts` so the profile page and dashboard share it.

### Navigation

Update `inertia/pages/dashboard.tsx`: replace the standalone Logout button area with a small dropdown anchored to the avatar — `Profile` item links to `/profile` (use `urlFor('profile.show')` from the Tuyau client), `Logout` keeps the current `Form` POST. Minimal scope: do not refactor the surrounding header beyond this.

### Flash handling

`FlashToasts` in `inertia/layouts/default.tsx` already surfaces `session.flash('success', …)` / `'error'` as toasts — controllers just need to flash and redirect back. No frontend wiring needed.

## Tests

`tests/functional/profile.spec.ts`:

- Guest hitting `GET /profile` → redirected by `auth` middleware.
- Authenticated user can `POST /profile` to update `firstName` / `lastName`; values persist.
- `POST /profile/avatar` with a valid image → file is written to the (faked) disk, `avatar_key` is set, the next page render exposes a non-null `avatarUrl`.
- `POST /profile/avatar` when `avatar_key` is already set → old key is deleted from the (faked) disk; new key replaces it.
- `POST /profile/avatar/delete` → file is removed from the disk, `avatar_key` is nulled.
- Validator rejects: file > 2 MB; extension `gif`; missing `avatar` field.

Uses `drive.fake()` so tests don't touch MinIO. After implementation, also run a manual smoke test against MinIO per the CLAUDE.md "test the golden path" rule.

## Open assumptions (callouts, not blockers)

- 2 MB / `jpg|jpeg|png|webp` is a sensible default; tighten or expand if needed.
- Avatars are public objects on a public-visibility disk. If we ever need access control, we'd switch the disk to private and serve via `getSignedUrl` — `avatar_key` storage is already compatible.
- We are not validating image *content* (only extension + size). VineJS's `vine.file()` doesn't sniff magic bytes. Acceptable for a self-service avatar; if abuse becomes an issue we can add a sniff step in the controller.
