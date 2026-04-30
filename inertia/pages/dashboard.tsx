import { useMemo } from 'react'
import { Form } from '@adonisjs/inertia/react'
import { router, useForm, usePage } from '@inertiajs/react'
import { LogOut, MoreHorizontal, Plus, Send, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { userInitials } from '@/lib/user'
import type { InertiaProps } from '@/types'

type RoleOption = {
  id: number
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  parentRoleId: number | null
  permissions: string[]
  assignable: boolean
}

type PendingInvitation = {
  id: number
  email: string | null
  role: string
  type: 'setup' | 'invite'
  expiresAt: string | null
}

type PermissionOption = {
  key: string
  description: string
}

type DashboardProps = {
  roles: RoleOption[]
  pendingInvitations: PendingInvitation[]
  permissionCatalog: PermissionOption[]
}

type RoleNode = RoleOption & { depth: number }

function groupPermissions(catalog: PermissionOption[]): Array<[string, PermissionOption[]]> {
  const groups: Record<string, PermissionOption[]> = {}
  for (const p of catalog) {
    const [resource] = p.key.split('.')
    if (!groups[resource]) groups[resource] = []
    groups[resource].push(p)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

/**
 * Flatten the role forest into a depth-first list with `depth` annotations,
 * matching how the server walks the recursive CTE. Roots are sorted by
 * displayName; within a parent, children sort the same way.
 */
function flattenRoleTree(roles: RoleOption[]): RoleNode[] {
  const byParent = new Map<number | null, RoleOption[]>()
  for (const role of roles) {
    const parentKey = role.parentRoleId
    if (!byParent.has(parentKey)) byParent.set(parentKey, [])
    byParent.get(parentKey)!.push(role)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  const out: RoleNode[] = []
  const knownIds = new Set(roles.map((r) => r.id))
  const visit = (parent: number | null, depth: number) => {
    const children = byParent.get(parent) ?? []
    for (const child of children) {
      out.push({ ...child, depth })
      visit(child.id, depth + 1)
    }
  }
  visit(null, 0)
  // Any role whose parent is not in the visible set (e.g. parent role hidden
  // by visibility scoping) is shown as a root so it isn't dropped silently.
  for (const role of roles) {
    if (role.parentRoleId !== null && !knownIds.has(role.parentRoleId)) {
      if (!out.find((r) => r.id === role.id)) {
        out.push({ ...role, depth: 0 })
      }
    }
  }
  return out
}

function CreateRoleCard({
  permissionCatalog,
  parentChoices,
}: {
  permissionCatalog: PermissionOption[]
  parentChoices: RoleOption[]
}) {
  const defaultParent = parentChoices[0]?.id ?? 0
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '',
    displayName: '',
    description: '',
    parentRoleId: defaultParent,
    permissions: [] as string[],
  })

  const grouped = useMemo(() => groupPermissions(permissionCatalog), [permissionCatalog])

  const togglePermission = (key: string, checked: boolean) => {
    setData(
      'permissions',
      checked ? [...data.permissions, key] : data.permissions.filter((k) => k !== key)
    )
  }

  const toggleGroup = (groupKeys: string[], checked: boolean) => {
    const set = new Set(data.permissions)
    if (checked) groupKeys.forEach((k) => set.add(k))
    else groupKeys.forEach((k) => set.delete(k))
    setData('permissions', [...set])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create role</CardTitle>
        <CardDescription>
          Pick a parent in the role tree, then choose what the new role can do.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          post('/roles', {
            preserveScroll: true,
            onSuccess: () => reset(),
          })
        }}
      >
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Slug</Label>
              <Input
                id="role-name"
                name="name"
                value={data.name}
                onChange={(e) => setData('name', e.target.value)}
                placeholder="editor"
                aria-invalid={errors.name ? true : undefined}
                required
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-display-name">Display name</Label>
              <Input
                id="role-display-name"
                name="displayName"
                value={data.displayName}
                onChange={(e) => setData('displayName', e.target.value)}
                placeholder="Editor"
                aria-invalid={errors.displayName ? true : undefined}
                required
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">{errors.displayName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                name="description"
                value={data.description}
                onChange={(e) => setData('description', e.target.value)}
                placeholder="What does this role do?"
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-parent">Parent role</Label>
              <Select
                value={data.parentRoleId ? String(data.parentRoleId) : ''}
                onValueChange={(v) => setData('parentRoleId', Number(v))}
              >
                <SelectTrigger id="role-parent" className="w-full">
                  <SelectValue placeholder="Pick a parent" />
                </SelectTrigger>
                <SelectContent>
                  {parentChoices.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.displayName}{' '}
                      <span className="ml-1 text-xs text-muted-foreground">{p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                The new role inherits hierarchy below this parent.
              </span>
              {errors.parentRoleId && (
                <p className="text-sm text-destructive">{errors.parentRoleId}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Permissions</Label>
              <span className="text-xs text-muted-foreground">
                {data.permissions.length} selected
              </span>
            </div>

            <div className="flex flex-col gap-4 rounded-md border border-border p-4">
              {grouped.map(([resource, items], index) => {
                const groupKeys = items.map((i) => i.key)
                const allChecked = groupKeys.every((k) => data.permissions.includes(k))
                return (
                  <div key={resource} className="flex flex-col gap-2">
                    {index > 0 && <Separator />}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-sm font-medium capitalize">{resource}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleGroup(groupKeys, !allChecked)}
                      >
                        {allChecked ? 'Clear' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((p) => {
                        const checked = data.permissions.includes(p.key)
                        return (
                          <label
                            key={p.key}
                            className="flex cursor-pointer items-start gap-2 rounded-sm py-1 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                togglePermission(p.key, value === true)
                              }
                              className="mt-0.5"
                            />
                            <span className="flex flex-col">
                              <span className="font-mono text-xs text-muted-foreground">
                                {p.key}
                              </span>
                              <span className="text-sm">{p.description}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            {errors.permissions && (
              <p className="text-sm text-destructive">{errors.permissions}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={processing || parentChoices.length === 0}>
            <Plus />
            {processing ? 'Creating…' : 'Create role'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function Dashboard({
  roles,
  pendingInvitations,
  permissionCatalog,
}: DashboardProps) {
  const { user } = usePage<InertiaProps<DashboardProps>>().props
  const userRoleNames = user?.roleNames ?? []
  const assignableRoles = roles.filter((r) => r.assignable)
  const defaultRoleId = assignableRoles[0]?.id ? String(assignableRoles[0].id) : ''
  const flatTree = useMemo(() => flattenRoleTree(roles), [roles])
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])
  // Owners and users in the user's subtree are valid parents for new roles —
  // i.e. the user's own roles plus everything assignable to them.
  const parentChoices = useMemo(() => {
    if (!user) return []
    if (user.isOwner) return roles
    const ownIds = new Set(user.roleIds ?? [])
    return roles.filter((r) => ownIds.has(r.id) || r.assignable)
  }, [roles, user])
  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
    : null

  const can = (key: string): boolean => {
    if (!user) return false
    if (user.isOwner) return true
    return user.permissions?.includes(key) ?? false
  }

  const canResend = can('invitations.resend')
  const canRevoke = can('invitations.revoke')
  const canCreateRole = can('roles.create')
  const canDeleteRole = can('roles.delete')

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage teammates and invitations.</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>
                {userInitials(user.firstName, user.lastName, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{fullName}</span>
              <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{user.email}</span>
                {user.isOwner ? (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    Owner
                  </Badge>
                ) : userRoleNames.length === 0 ? (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    no role
                  </Badge>
                ) : (
                  userRoleNames.map((name) => (
                    <Badge key={name} variant="outline" className="px-1.5 py-0 text-[10px]">
                      {name}
                    </Badge>
                  ))
                )}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.visit('/profile')}>
              Profile
            </Button>
            <Form action="/logout" method="post">
              {({ processing }) => (
                <Button type="submit" variant="outline" size="sm" disabled={processing}>
                  <LogOut />
                  {processing ? 'Signing out…' : 'Logout'}
                </Button>
              )}
            </Form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>Send an invitation email to join the workspace.</CardDescription>
          </CardHeader>
          <Form action="/invitations" method="post" resetOnSuccess>
            {({ errors, processing }) => (
              <>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select name="roleId" defaultValue={defaultRoleId}>
                      <SelectTrigger id="invite-role" className="w-full">
                        <SelectValue placeholder="Pick a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((role) => {
                          const parent = role.parentRoleId
                            ? rolesById.get(role.parentRoleId)
                            : null
                          return (
                            <SelectItem key={role.id} value={String(role.id)}>
                              {role.displayName}
                              {parent && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  under {parent.displayName}
                                </span>
                              )}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {errors.roleId && (
                      <p className="text-sm text-destructive">{errors.roleId}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {assignableRoles.length === 0
                      ? 'No roles below your subtree — create one first.'
                      : `${assignableRoles.length} role${assignableRoles.length === 1 ? '' : 's'} in your subtree.`}
                  </span>
                  <Button type="submit" disabled={processing || assignableRoles.length === 0}>
                    <Send />
                    {processing ? 'Sending…' : 'Send invite'}
                  </Button>
                </CardFooter>
              </>
            )}
          </Form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
            <CardDescription>
              {pendingInvitations.length === 0
                ? 'No pending invitations.'
                : `${pendingInvitations.length} awaiting response`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvitations.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{userInitials(null, null, invite.email)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {invite.email ?? '(setup link)'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mr-2">
                        {invite.type}
                      </Badge>
                      {invite.role}
                    </span>
                  </div>
                </div>
                {(canResend || canRevoke) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canResend && (
                        <DropdownMenuItem
                          disabled={!invite.email}
                          onSelect={() =>
                            router.post(
                              `/invitations/${invite.id}/resend`,
                              {},
                              { preserveScroll: true }
                            )
                          }
                        >
                          Resend
                        </DropdownMenuItem>
                      )}
                      {canResend && canRevoke && <DropdownMenuSeparator />}
                      {canRevoke && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            if (
                              !window.confirm(
                                `Revoke invitation${invite.email ? ` for ${invite.email}` : ''}?`
                              )
                            )
                              return
                            router.post(
                              `/invitations/${invite.id}/revoke`,
                              {},
                              { preserveScroll: true }
                            )
                          }}
                        >
                          Revoke
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {canCreateRole && (
          <div className="lg:col-span-2">
            <CreateRoleCard
              permissionCatalog={permissionCatalog}
              parentChoices={parentChoices}
            />
          </div>
        )}

        <Card className={canCreateRole ? '' : 'lg:col-span-3'}>
          <CardHeader>
            <CardTitle>Role tree</CardTitle>
            <CardDescription>
              {roles.length} role{roles.length === 1 ? '' : 's'} configured. Each row's
              indent shows its place in the hierarchy.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {flatTree.map((role) => (
              <div
                key={role.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                style={{ marginLeft: role.depth * 16 }}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {role.depth > 0 && (
                      <span
                        aria-hidden
                        className="text-muted-foreground"
                      >{'└'.padStart(role.depth, ' ')}</span>
                    )}
                    <span className="text-sm font-medium">{role.displayName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{role.name}</span>
                    {role.isSystem && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        system
                      </Badge>
                    )}
                    {role.assignable && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        in your subtree
                      </Badge>
                    )}
                  </div>
                  {role.description && (
                    <span className="text-xs text-muted-foreground">{role.description}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? '' : 's'}
                  </span>
                </div>
                {canDeleteRole && !role.isSystem && role.assignable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (!window.confirm(`Delete role "${role.displayName}"?`)) return
                      router.post(`/roles/${role.id}/delete`, {}, { preserveScroll: true })
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
