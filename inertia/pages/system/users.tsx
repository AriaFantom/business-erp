import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useForm, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { MoreHorizontal, ShieldCheck, Users } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DashboardLayout from '@/layouts/dashboard-layout'
import { userInitials } from '@/lib/user'
import type { InertiaProps } from '@/types'

type UserRow = {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  isOwner: boolean
  roles: { id: number; name: string; displayName: string }[]
}

type AssignableRole = {
  id: number
  name: string
  displayName: string
}

type UsersPageProps = {
  users: UserRow[]
  assignableRoles: AssignableRole[]
  currentUserId: number
}

function fullNameOf(row: UserRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email
}

/**
 * UI-only mirror of the server's editRoles policy. Source of truth is the
 * backend; this exists purely to hide actions the actor cannot use.
 */
function isClientEditable(row: UserRow, actor: NonNullable<InertiaProps['user']>): boolean {
  if (row.id === actor.id) return false
  if (row.isOwner) return false
  if (actor.isOwner) return true
  if (!actor.permissions?.includes('users.assignRole')) return false
  return row.roles.length > 0
}

function EditRolesDialog({
  target,
  assignableRoles,
  onClose,
}: {
  target: UserRow
  assignableRoles: AssignableRole[]
  onClose: () => void
}) {
  const initialIds = useMemo(
    () => target.roles.map((r) => r.id).sort((a, b) => a - b),
    [target]
  )

  const { data, setData, post, processing, errors, reset } = useForm({
    roleIds: initialIds,
  })

  useEffect(() => {
    setData('roleIds', initialIds)
  }, [target.id, initialIds, setData])

  const toggle = (roleId: number, checked: boolean) => {
    const set = new Set(data.roleIds)
    if (checked) set.add(roleId)
    else set.delete(roleId)
    setData('roleIds', [...set].sort((a, b) => a - b))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    post(`/system/users/${target.id}/roles`, {
      preserveScroll: true,
      onSuccess: () => {
        reset()
        onClose()
      },
    })
  }

  const noChange =
    data.roleIds.length === initialIds.length &&
    data.roleIds.every((id, i) => id === initialIds[i])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit roles for {fullNameOf(target)}</DialogTitle>
          <DialogDescription>
            Choose which roles this user should hold. At least one role is required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-md border border-border p-3 max-h-72 overflow-y-auto">
            {assignableRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No roles in your subtree to assign.
              </p>
            ) : (
              assignableRoles.map((role) => {
                const checked = data.roleIds.includes(role.id)
                return (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-start gap-2 rounded-sm py-1 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggle(role.id, value === true)}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{role.displayName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {role.name}
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </div>

          {errors.roleIds && <p className="text-sm text-destructive">{errors.roleIds}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={processing}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                processing ||
                data.roleIds.length === 0 ||
                assignableRoles.length === 0 ||
                noChange
              }
            >
              {processing ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function SystemUsers({
  users,
  assignableRoles,
  currentUserId,
}: UsersPageProps) {
  const { user: actor } = usePage<InertiaProps<UsersPageProps>>().props
  const [editing, setEditing] = useState<UserRow | null>(null)

  if (!actor) return null

  const canAssign = actor.isOwner || (actor.permissions?.includes('users.assignRole') ?? false)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">User List</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} user{users.length === 1 ? '' : 's'} in your scope.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {canAssign
              ? 'You can change role assignments for users in your subtree.'
              : 'You can view users in your subtree. Role editing requires the users.assignRole permission.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users in your scope"
              description="Invite a teammate to give them access to the panel."
              action={
                <Button asChild variant="outline">
                  <Link href="/system/invitations">Invite users</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((row) => {
                  const editable = isClientEditable(row, actor)
                  const isSelf = row.id === currentUserId
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {userInitials(row.firstName, row.lastName, row.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">
                              {fullNameOf(row)}
                              {isSelf && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {row.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.roles.length === 0 ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            no role
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.roles.map((r) => (
                              <Badge key={r.id} variant="outline">
                                {r.displayName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.isOwner ? (
                          <Badge variant="secondary">Owner</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canAssign && editable ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setEditing(row)}>
                                <ShieldCheck />
                                Edit roles
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditRolesDialog
          target={editing}
          assignableRoles={assignableRoles}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

SystemUsers.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
