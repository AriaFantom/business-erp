import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { router, useForm, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ShieldCheck, UserRoundCheck, UserRoundX, Users } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  InvitationsPanel,
  type PendingInvitation,
  type RoleOption,
} from '@/pages/system/invitations'

type UserRow = {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  isOwner: boolean
  isActive: boolean
  editable: boolean
  accessEditable: boolean
  roles: { id: number; name: string; displayName: string }[]
}

type AssignableRole = {
  id: number
  name: string
  displayName: string
}

type UsersPageProps = {
  users?: UserRow[]
  assignableRoles?: AssignableRole[]
  currentUserId?: number
  roles?: RoleOption[]
  pendingInvitations?: PendingInvitation[]
  canViewUsers: boolean
  canViewInvitations: boolean
  initialTab: 'users' | 'invitations'
}

function fullNameOf(row: UserRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email
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
  const initialIds = useMemo(() => target.roles.map((r) => r.id).sort((a, b) => a - b), [target])

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
    setData(
      'roleIds',
      [...set].sort((a, b) => a - b)
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    post(`/system/users/${target.id}/roles`, {
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => {
        router.flushAll()
        reset()
        onClose()
      },
    })
  }

  const noChange =
    data.roleIds.length === initialIds.length && data.roleIds.every((id, i) => id === initialIds[i])

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
              <p className="text-sm text-muted-foreground">No lower-ranked roles to assign.</p>
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
                      <span className="font-mono text-xs text-muted-foreground">{role.name}</span>
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
                processing || data.roleIds.length === 0 || assignableRoles.length === 0 || noChange
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
  users = [],
  assignableRoles = [],
  currentUserId = 0,
  roles = [],
  pendingInvitations = [],
  canViewUsers,
  canViewInvitations,
  initialTab,
}: UsersPageProps) {
  const { user: actor } = usePage<InertiaProps<UsersPageProps>>().props
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [changingAccess, setChangingAccess] = useState<UserRow | null>(null)
  const [accessProcessing, setAccessProcessing] = useState(false)
  const [showRevoked, setShowRevoked] = useState(false)
  const activeUsers = users.filter((row) => row.isActive)
  const revokedUsers = users.filter((row) => !row.isActive)
  const displayedUsers = showRevoked ? revokedUsers : activeUsers

  if (!actor) return null

  const canAssign = actor.isOwner || (actor.permissions?.includes('users.assignRole') ?? false)

  const submitAccessChange = () => {
    if (!changingAccess || accessProcessing) return
    setAccessProcessing(true)
    router.post(
      `/system/users/${changingAccess.id}/access`,
      { active: !changingAccess.isActive },
      {
        preserveScroll: true,
        preserveState: false,
        onSuccess: () => {
          router.flushAll()
          setChangingAccess(null)
        },
        onFinish: () => setAccessProcessing(false),
      }
    )
  }

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Users & Invitations</h1>
        <p className="text-sm text-muted-foreground">
          Manage workspace access, roles, and outstanding invitations.
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          {canViewUsers && <TabsTrigger value="users">Users</TabsTrigger>}
          {canViewInvitations && <TabsTrigger value="invitations">Invitations</TabsTrigger>}
        </TabsList>
        {canViewUsers && (
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{showRevoked ? 'Revoked users' : 'Users'}</CardTitle>
                  {(showRevoked || revokedUsers.length > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRevoked((value) => !value)}
                    >
                      {showRevoked ? 'Show active users' : `Revoked (${revokedUsers.length})`}
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {showRevoked
                    ? 'These accounts are hidden from the active list. Restore access here when needed.'
                    : canAssign
                      ? 'You can change role assignments for users below your rank.'
                      : 'You can view users below your rank. Role editing requires the users.assignRole permission.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {displayedUsers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No users in your scope"
                    description={
                      showRevoked
                        ? 'No revoked users in your scope.'
                        : 'Invite a teammate to give them access to the panel.'
                    }
                    action={
                      canViewInvitations ? (
                        <Button asChild variant="outline">
                          <Link href="/system/users?tab=invitations">Invite users</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedUsers.map((row) => {
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
                              ) : row.isActive ? (
                                <Badge variant="outline">Active</Badge>
                              ) : (
                                <Badge variant="destructive">Revoked</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {canAssign && row.editable && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label={`Change roles for ${fullNameOf(row)}`}
                                    title="Change roles"
                                    onClick={() => setEditing(row)}
                                  >
                                    <ShieldCheck />
                                  </Button>
                                )}
                                {row.accessEditable && (
                                  <Button
                                    variant={row.isActive ? 'destructive' : 'outline'}
                                    size="icon"
                                    aria-label={`${row.isActive ? 'Revoke' : 'Restore'} access for ${fullNameOf(row)}`}
                                    title={row.isActive ? 'Revoke access' : 'Restore access'}
                                    onClick={() => setChangingAccess(row)}
                                  >
                                    {row.isActive ? <UserRoundX /> : <UserRoundCheck />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {canViewInvitations && (
          <TabsContent value="invitations" className="mt-4">
            <InvitationsPanel roles={roles} pendingInvitations={pendingInvitations} />
          </TabsContent>
        )}
      </Tabs>

      {editing && (
        <EditRolesDialog
          target={editing}
          assignableRoles={assignableRoles}
          onClose={() => setEditing(null)}
        />
      )}
      <Dialog
        open={Boolean(changingAccess)}
        onOpenChange={(open) => !open && setChangingAccess(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {changingAccess?.isActive ? 'Revoke user access?' : 'Restore user access?'}
            </DialogTitle>
            <DialogDescription>
              {changingAccess?.isActive
                ? `${changingAccess.email} will be signed out on their next request and cannot log in. Their data and roles will be preserved.`
                : `${changingAccess?.email} will be able to log in again with their existing roles.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={accessProcessing}
              onClick={() => setChangingAccess(null)}
            >
              Cancel
            </Button>
            <Button
              variant={changingAccess?.isActive ? 'destructive' : 'default'}
              disabled={accessProcessing}
              onClick={submitAccessChange}
            >
              {accessProcessing
                ? 'Saving…'
                : changingAccess?.isActive
                  ? 'Revoke access'
                  : 'Restore access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

SystemUsers.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
