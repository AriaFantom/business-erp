# Dashboard Sidebar & System Navigation — Design

**Date:** 2026-05-01
**Status:** Approved (pending implementation)
**Author:** Claude (brainstormed with priyanshudebnath348@gmail.com)

## Goal

Introduce a persistent, collapsible sidebar to every authenticated page. The
sidebar exposes a Dashboard landing page plus a permission-gated **System**
group containing **Role Management**, **User Invitation**, and a new **User
List**. The bottom of the sidebar carries the current user's avatar + name with
a dropdown for Account Settings (→ `/profile`) and Logout. The existing
`/dashboard` page is reduced to an empty landing placeholder; its role and
invitation functionality moves into the new System pages. A new
`/system/users` page lists workspace users and lets sufficiently privileged
admins edit each user's role assignments — subject to strict server-side
authorisation rules.

## Non-Goals

- Rewriting `/dashboard`'s content (deferred, scheduled for a later task)
- Inviting/creating users directly from the User List (the Invitation page
  remains the entry point for new users)
- Bulk role edits, CSV import/export, or audit logs
- Friendly Inertia 403 page; the default AdonisJS 403 is acceptable for v1
- Allowing zero-role users (validator enforces a minimum of one role)
- Real logo/branding asset in `SidebarHeader` — a wordmark suffices

## Architecture Overview

### File map

```
inertia/
├── layouts/
│   ├── default.tsx              (unchanged — global Sonner toaster wrapper)
│   └── dashboard-layout.tsx     NEW — SidebarProvider + AppSidebar + SidebarInset
├── components/
│   ├── app-sidebar.tsx          NEW — composes Sidebar with header/content/footer
│   ├── nav-main.tsx             NEW — Dashboard + System group
│   ├── nav-user.tsx             NEW — bottom avatar dropdown
│   ├── sidebar-nav.ts           NEW — declarative nav config keyed by permission
│   └── ui/
│       ├── sidebar.tsx          NEW — installed via `npx shadcn add sidebar`
│       ├── sheet.tsx            NEW — peer dep of sidebar (mobile drawer)
│       ├── tooltip.tsx          NEW — peer dep of sidebar (icon-mode hints)
│       ├── collapsible.tsx      NEW — peer dep of sidebar (sub-menu)
│       ├── dialog.tsx           NEW — used by User List edit-roles modal
│       └── skeleton.tsx         NEW — peer dep of sidebar
└── pages/
    ├── dashboard.tsx            REWRITTEN — minimal placeholder
    ├── system/
    │   ├── roles.tsx            NEW — role tree + create role (split from old dashboard)
    │   ├── invitations.tsx      NEW — invite form + pending invites (split from old dashboard)
    │   └── users.tsx            NEW — user list with role editor
    └── profile/edit.tsx         (unchanged)

app/
├── controllers/
│   ├── dashboard_controller.ts   SIMPLIFIED — render empty dashboard, no data
│   ├── roles_controller.ts       EXPANDED  — add `index` for /system/roles
│   ├── invitations_controller.ts EXPANDED  — add `index` for /system/invitations
│   └── users_controller.ts       EXPANDED  — add `index` and `updateRoles`
├── validators/
│   └── users_validator.ts        NEW — updateUserRolesValidator
└── policies/
    └── user_policy.ts            NEW — viewList, editRoles(target) hierarchy rules

start/
└── routes.ts                     +GET /system/roles, /system/invitations, /system/users
                                  +POST /system/users/:id/roles
```

### Routes summary (auth group)

```ts
router.get ('dashboard',                ...)
router.get ('system/roles',             [RolesController,        'index'])
router.get ('system/invitations',       [InvitationsController,  'index'])
router.get ('system/users',             [UsersController,        'index'])
router.post('system/users/:id/roles',   [UsersController,        'updateRoles'])
// existing POSTs (/roles, /invitations, /invitations/:id/resend|revoke,
// /roles/:id/delete, /profile, /profile/avatar*) keep working unchanged.
```

## Frontend: Sidebar & Layout

### Layout attachment via Inertia persistent layouts

```tsx
// inertia/layouts/dashboard-layout.tsx
export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

Each authenticated page opts in:

```tsx
// pages/dashboard.tsx, pages/system/*.tsx, pages/profile/edit.tsx
Dashboard.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
```

`default.tsx` remains the global wrapper (Sonner toasts). Inertia composes
both: page → DashboardLayout → DefaultLayout. Login/signup/error pages omit
`Page.layout` and therefore never render the sidebar.

### `sidebar-nav.ts` — declarative nav config

```ts
type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  permission?: string  // undefined = visible to every authenticated user
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  {
    title: 'System',
    url: '#',
    icon: Settings2,
    children: [
      { title: 'Role Management', url: '/system/roles',       icon: ShieldCheck, permission: 'roles.view'    },
      { title: 'User Invitation', url: '/system/invitations', icon: Mail,        permission: 'users.invite'  },
      { title: 'User List',       url: '/system/users',       icon: Users,       permission: 'users.view'    },
    ],
  },
]
```

### `nav-main.tsx` — gating + active state

```ts
function can(user, key?: string): boolean {
  if (!user || !key) return true
  return user.isOwner || user.permissions.includes(key)
}

function isVisible(item: NavItem, user): boolean {
  if (item.children) return item.children.some((c) => isVisible(c, user))
  return can(user, item.permission)
}
```

- Top-level items render as `<SidebarMenuItem>` + `<SidebarMenuButton>`.
- The **System** group uses `<Collapsible>` + `<SidebarMenuSub>` for its
  children. It defaults to expanded if the current URL matches any child route.
- Hidden entirely via `isVisible(...) === false`. The System parent disappears
  if the user has none of `roles.view`, `users.invite`, `users.view`.
- Active styling: compare `usePage().url` against `item.url` (Inertia-native;
  no `react-router`).

### `nav-user.tsx` — bottom dropdown

```tsx
<SidebarFooter>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <SidebarMenuButton size="lg">
        <Avatar>
          <AvatarImage src={user.avatarUrl} />
          <AvatarFallback>{userInitials(...)}</AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left">
          <span>{fullName}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
        <ChevronsUpDown />
      </SidebarMenuButton>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      side={isMobile ? 'bottom' : 'right'}
      align="end"
    >
      <DropdownMenuItem onSelect={() => router.visit('/profile')}>
        <Settings /> Account Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => router.post('/logout', {}, { preserveScroll: false })}
      >
        <LogOut /> Logout
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</SidebarFooter>
```

### Responsive / collapse behaviour

All provided by shadcn:

- **Desktop:** `<Sidebar collapsible="icon">` — full-width by default,
  collapses to a 48px icon-only rail. State persists via the
  `sidebar:state` cookie set by `SidebarProvider`.
- **Mobile (≤ 768px):** `useSidebar().isMobile` switches the sidebar to a
  `Sheet` drawer triggered by `<SidebarTrigger>`.
- **Keyboard:** `Ctrl/Cmd+B` toggles. Built into `SidebarProvider`.
- **Icon-only mode tooltips:** `<SidebarMenuButton>` supports a `tooltip`
  prop that surfaces the label on hover when collapsed.

## Backend: User List & Page Routes

### Permissions (no key changes)

`start/permissions.ts` already defines everything we need: `users.view`,
`users.assignRole`, `users.invite`, `roles.view`, `invitations.view`.

### `app/policies/user_policy.ts`

```ts
export default class UserPolicy extends BasePolicy {
  async viewList(actor: User): Promise<AuthorizerResponse> {
    return actor.isOwner || (await actor.getPermissions()).includes('users.view')
  }

  async editRoles(actor: User, target: User): Promise<AuthorizerResponse> {
    if (target.id === actor.id) return false                  // SECURITY: no self-edit
    if (target.isOwner)         return false                  // SECURITY: workspace owner is immutable here
    if (actor.isOwner)          return true

    const perms = await actor.getPermissions()
    if (!perms.includes('users.assignRole')) return false

    const assignableRoleIds = await actor.getAssignableRoleIds()
    const targetRoleIds = (await target.getRoles()).map((r) => r.id)
    return targetRoleIds.length === 0
      ? false
      : targetRoleIds.every((id) => assignableRoleIds.includes(id))
  }
}
```

### `UsersController`

```ts
export default class UsersController {
  async index({ inertia, bouncer, auth }: HttpContext) {
    await bouncer.with('UserPolicy').authorize('viewList')

    const actor = auth.user!
    const assignableRoleIds = actor.isOwner ? null : await actor.getAssignableRoleIds()
    const allRoles = await Role.query().orderBy('displayName')

    const users = await User.query().preload('roles').orderBy('createdAt', 'desc')
    const visibleUsers = actor.isOwner
      ? users
      : users.filter(
          (u) =>
            u.id !== actor.id &&
            !u.isOwner &&
            u.roles.length > 0 &&
            u.roles.every((r) => assignableRoleIds!.includes(r.id))
        )

    return inertia.render('system/users', {
      users: visibleUsers.map(serializeUserRow),
      assignableRoles: allRoles
        .filter((r) => actor.isOwner || assignableRoleIds!.includes(r.id))
        .map((r) => ({ id: r.id, displayName: r.displayName, name: r.name })),
    })
  }

  async updateRoles({ params, request, bouncer, auth, response, session }: HttpContext) {
    const target = await User.findOrFail(params.id)
    await bouncer.with('UserPolicy').authorize('editRoles', target)

    const { roleIds } = await request.validateUsing(updateUserRolesValidator)
    await ensureRolesAssignable(auth.user!, roleIds)        // SECURITY: defence in depth — re-check every roleId
    await target.related('roles').sync(roleIds)

    session.flash('success', 'Roles updated.')
    return response.redirect().back()
  }
}
```

### `app/validators/users_validator.ts`

```ts
export const updateUserRolesValidator = vine.compile(
  vine.object({
    roleIds: vine.array(vine.number().positive()).distinct().minLength(1).maxLength(20),
  })
)
```

### `RolesController#index` and `InvitationsController#index`

Both extract their slice of view-model data from the existing
`DashboardController#index` logic (refactored into shared helpers like
`getRolesViewModel(user)` and `getInvitationsViewModel(user)`). Existing POST
endpoints stay where they are. Bouncer guards each `index`:

- `RolesController#index` → permission `roles.view`
- `InvitationsController#index` → permission `users.invite` (matches sidebar
  gating exactly so the nav link and page authorisation never disagree)

`DashboardController#index` simplifies to `inertia.render('dashboard', {})`.

## Frontend: User List Page

### Props shape

```ts
type UserRow = {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  isOwner: boolean
  roles: { id: number; name: string; displayName: string }[]
}

type Props = {
  users: UserRow[]
  assignableRoles: { id: number; name: string; displayName: string }[]
}
```

### Table layout (shadcn `Table` inside a `Card`)

| Column   | Content                                                                                   |
|----------|-------------------------------------------------------------------------------------------|
| User     | `<Avatar>` + name + email                                                                 |
| Roles    | `<Badge variant="outline">` per role; muted "(no role)" if empty                          |
| Status   | `<Badge variant="secondary">Owner</Badge>` if `isOwner`, blank otherwise                  |
| Actions  | `<DropdownMenu>` with "Edit roles" — only when `can('users.assignRole')` AND row editable |

Client-side editability mirror (UI-only; server is authoritative):

```ts
const isEditable = (row: UserRow) =>
  row.id !== currentUser.id && !row.isOwner
```

### Edit-roles dialog

A shadcn `Dialog` containing a checkbox group matching the existing
`CreateRoleCard` pattern. Submits to `/system/users/:id/roles` via `useForm`.
On success: dialog closes, flash toast, Inertia reloads the `users` prop.

Empty / partial states:

- No editable users in scope: empty card "No users in your scope."
- `assignableRoles` empty: disable Save with helper text "No roles in your
  subtree to assign."

## Security Concerns (Non-Negotiable)

These rules are enforced **server-side**. Frontend hides UI optimistically but
never gates security.

| Risk | Mitigation |
|---|---|
| **Self-edit lockout** — user removes the role granting `users.assignRole` from themselves | `editRoles` policy returns `false` for `target.id === actor.id`. Self-management is funnelled exclusively through `/profile`, which never edits roles. |
| **Owner demotion** — workspace owner accidentally stripped of access | `editRoles` returns `false` when `target.isOwner`. The workspace-owner singleton is immutable through this surface. |
| **Privilege escalation** — actor assigns a role outside their assignable subtree | Validator only checks shape. `UsersController#updateRoles` calls `ensureRolesAssignable(actor, roleIds)` after the policy check, throwing `403` if any roleId is outside the subtree. Defence in depth on top of the policy's view-time filter. |
| **Stale UI** — actor's permissions change mid-session and they POST anyway | Server re-runs bouncer + assignable-role check on every POST; stale clients receive `403`. |
| **Direct URL access** — user without `users.view` types `/system/users` | `bouncer.authorize('viewList')` in `index` throws `AuthorizationException` → AdonisJS 403. |
| **Role ID tampering** — non-existent or negative IDs | Vine validator rejects (`positive()`); `sync()` against unknown IDs would create orphan pivot rows, so `ensureRolesAssignable` checks existence too. |
| **Concurrent edits** — two admins edit the same user simultaneously | `sync()` is row-level idempotent — last write wins. Acceptable for v1; optimistic locking via `updated_at` is a future iteration. |
| **Visibility leak** — actor sees user X, then loses subtree access including X | Next page load re-filters. No client-persisted state. |
| **Cross-permission leakage on the UI** — sidebar showing System parent without any visible child | `isVisible()` rolls up child visibility; parent hidden when all children are hidden. |

## Testing

Functional tests under `tests/functional/system/`:

1. `users_index.spec.ts`
   - Owner sees all users.
   - User with `users.view` sees only users in their assignable subtree.
   - User without `users.view` gets 403.

2. `users_update_roles.spec.ts`
   - Owner can assign any role to any non-owner user.
   - User with `users.assignRole` can assign roles within their subtree.
   - User with `users.assignRole` **cannot** assign a role outside their
     subtree → 403.
   - Cannot edit self → 403.
   - Cannot edit workspace owner → 403.
   - Validator rejects empty `roleIds`, non-numbers, duplicates, > 20.

3. `system_pages_access.spec.ts`
   - GET `/system/roles` requires `roles.view`.
   - GET `/system/invitations` requires `users.invite`.
   - GET `/system/users` requires `users.view`.

We do **not** add browser tests for sidebar collapse behaviour — shadcn already
covers it. We do **not** add unit tests for the nav config — it's pure data.

## Open Decisions Punted to Implementation

- Whether `getRolesViewModel` / `getInvitationsViewModel` live in the
  controllers themselves or in `app/services/`. Lean toward services if the
  helpers grow non-trivial; otherwise keep colocated.
- Whether `ensureRolesAssignable` is a free function or a method on `User`.
  Free function is fine; co-locate with the policy.
- Brand wordmark in `SidebarHeader`: literal "Layerdreams" text node for now.

## Acceptance

- Login lands on `/dashboard`, which shows the new sidebar and an empty
  placeholder body.
- Sidebar collapses to icon-only via the toggle button or `Ctrl/Cmd+B`. Icon
  hover shows tooltip labels. State persists across reloads.
- Mobile width opens the sidebar as a slide-in drawer.
- The System group only appears for users with at least one of `roles.view`,
  `users.invite`, `users.view`. Each child link is independently gated.
- Bottom dropdown navigates to `/profile` (Account Settings) or POSTs to
  `/logout`.
- `/system/roles` shows the existing role tree + create-role form, gated by
  `roles.view`.
- `/system/invitations` shows the existing invite form + pending invitations,
  gated by `users.invite`.
- `/system/users` shows users in the actor's scope with their roles. Edit
  dialog allows multi-role assignment for users in the actor's subtree.
- All listed security concerns are verifiably enforced by the server.
