import { useEffect, useState, type ReactElement } from 'react'
import { Form } from '@adonisjs/inertia/react'
import { router, usePage } from '@inertiajs/react'
import { MoreHorizontal, Send } from 'lucide-react'

import { ConfirmDialog } from '@/components/confirm-dialog'

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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import DashboardLayout from '@/layouts/dashboard-layout'
import { userInitials } from '@/lib/user'
import type { InertiaProps } from '@/types'

type RoleOption = {
  id: number
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  rankPosition: number
  permissions: string[]
  assignable: boolean
}

type PendingInvitation = {
  id: number
  email: string | null
  role: string
  type: 'setup' | 'invite'
  expiresAt: string | null
  deliveryStatus: 'unknown' | 'sent' | 'failed'
  expired: boolean
}

type InvitationsPageProps = {
  roles: RoleOption[]
  pendingInvitations: PendingInvitation[]
}

export default function SystemInvitations({ roles, pendingInvitations }: InvitationsPageProps) {
  const { user } = usePage<InertiaProps<InvitationsPageProps>>().props

  const assignableRoles = roles.filter((r) => r.assignable)
  const defaultRoleId = assignableRoles[0]?.id ? String(assignableRoles[0].id) : ''

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        router.reload({ only: ['pendingInvitations'] })
      }
    }
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 15_000)
    return () => {
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [])

  const can = (key: string): boolean => {
    if (!user) return false
    if (user.isOwner) return true
    return user.permissions?.includes(key) ?? false
  }

  const canResend = can('invitations.resend')
  const canRevoke = can('invitations.revoke')

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">User Invitation</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates and manage outstanding invitations.
        </p>
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
                        <SelectGroup>
                          {assignableRoles.map((role) => (
                            <SelectItem key={role.id} value={String(role.id)}>
                              {role.displayName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {errors.roleId && <p className="text-sm text-destructive">{errors.roleId}</p>}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {assignableRoles.length === 0
                      ? 'No roles below your rank — create one first.'
                      : `${assignableRoles.length} role${assignableRoles.length === 1 ? '' : 's'} below your rank.`}
                  </span>
                  <Button
                    type="submit"
                    disabled={processing || assignableRoles.length === 0}
                    className="shrink-0"
                  >
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
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              {pendingInvitations.length === 0
                ? 'No invitations awaiting acceptance.'
                : `${pendingInvitations.length} awaiting response`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
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
                    <span className="text-xs text-muted-foreground">{invite.role}</span>
                    <Badge
                      variant={
                        invite.deliveryStatus === 'failed' || invite.expired
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {invite.expired
                        ? 'Expired — resend'
                        : invite.deliveryStatus === 'sent'
                          ? 'Sent — awaiting acceptance'
                          : invite.deliveryStatus === 'failed'
                            ? 'Email failed — retry'
                            : 'Awaiting acceptance'}
                    </Badge>
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
                          {invite.deliveryStatus === 'failed' ? 'Retry email' : 'Resend'}
                        </DropdownMenuItem>
                      )}
                      {canResend && canRevoke && <DropdownMenuSeparator />}
                      {canRevoke && (
                        <RevokeInvitationItem invitationId={invite.id} email={invite.email} />
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RevokeInvitationItem({
  invitationId,
  email,
}: {
  invitationId: number
  email: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <DropdownMenuItem
        variant="destructive"
        onSelect={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        Revoke
      </DropdownMenuItem>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Revoke invitation${email ? ` for ${email}` : ''}?`}
        description="The invitation link will stop working immediately."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={() =>
          router.post(`/invitations/${invitationId}/revoke`, {}, { preserveScroll: true })
        }
      />
    </>
  )
}

SystemInvitations.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
