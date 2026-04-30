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
import type { InertiaProps } from '@/types'

type RoleOption = {
  id: number
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  priority: number
  permissions: string[]
  assignable: boolean
}

// Wire sentinel matching OWNER_PRIORITY in the inertia middleware.
const OWNER_PRIORITY = Number.MAX_SAFE_INTEGER

function priorityLabel(priority: number): string {
  if (priority >= OWNER_PRIORITY) return 'Owner ∞'
  return `Lvl ${priority}`
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

function initialsFor(email: string | null): string {
  if (!email) return '?'
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase() || '?'
}

function userInitials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  const first = firstName?.trim().charAt(0) ?? ''
  const last = lastName?.trim().charAt(0) ?? ''
  const combined = `${first}${last}`.toUpperCase()
  if (combined) return combined
  return initialsFor(email ?? null)
}

function groupPermissions(catalog: PermissionOption[]): Array<[string, PermissionOption[]]> {
  const groups: Record<string, PermissionOption[]> = {}
  for (const p of catalog) {
    const [resource] = p.key.split('.')
    if (!groups[resource]) groups[resource] = []
    groups[resource].push(p)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

function CreateRoleCard({
  permissionCatalog,
  maxPriority,
}: {
  permissionCatalog: PermissionOption[]
  maxPriority: number
}) {
  const cap = Math.min(maxPriority - 1, 99)
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '',
    displayName: '',
    description: '',
    priority: Math.max(0, Math.min(10, cap)),
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
        <CardDescription>Define a new role and pick the permissions it grants.</CardDescription>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2 sm:col-span-2">
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
              <Label htmlFor="role-priority">Priority</Label>
              <Input
                id="role-priority"
                name="priority"
                type="number"
                min={0}
                max={cap}
                value={data.priority}
                onChange={(e) => setData('priority', Number(e.target.value))}
                aria-invalid={errors.priority ? true : undefined}
              />
              <span className="text-xs text-muted-foreground">
                0–{cap}. Lower than your level.
              </span>
              {errors.priority && (
                <p className="text-sm text-destructive">{errors.priority}</p>
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
                const someChecked = !allChecked && groupKeys.some((k) => data.permissions.includes(k))
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
                        {allChecked ? 'Clear' : someChecked ? 'Select all' : 'Select all'}
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
          <Button type="submit" disabled={processing}>
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
  const myPriority = user?.priority ?? 0
  const assignableRoles = roles.filter((r) => r.assignable)
  const defaultRoleId = assignableRoles[0]?.id ? String(assignableRoles[0].id) : ''
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
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{user.email}</span>
                {user.isOwner ? (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    Owner
                  </Badge>
                ) : (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {priorityLabel(myPriority)}
                  </Badge>
                )}
              </span>
            </div>
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
                        {assignableRoles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.displayName}{' '}
                            <span className="ml-1 text-xs text-muted-foreground">
                              {priorityLabel(role.priority)}
                            </span>
                          </SelectItem>
                        ))}
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
                      ? 'No roles below your level — create one first.'
                      : `${assignableRoles.length} role${assignableRoles.length === 1 ? '' : 's'} available to assign.`}
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
                    <AvatarFallback>{initialsFor(invite.email)}</AvatarFallback>
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
              maxPriority={myPriority}
            />
          </div>
        )}

        <Card className={canCreateRole ? '' : 'lg:col-span-3'}>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              {roles.length} role{roles.length === 1 ? '' : 's'} configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{role.displayName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{role.name}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {priorityLabel(role.priority)}
                    </Badge>
                    {role.isSystem && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        system
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
                {canDeleteRole && !role.isSystem && role.priority < myPriority && (
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
