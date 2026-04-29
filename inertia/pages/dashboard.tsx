import { Form } from '@adonisjs/inertia/react'
import { MoreHorizontal, Send } from 'lucide-react'

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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type RoleOption = {
  id: number
  name: string
  displayName: string
}

type PendingInvitation = {
  id: number
  email: string | null
  role: string
  type: 'setup' | 'invite'
  expiresAt: string | null
}

type DashboardProps = {
  roles: RoleOption[]
  pendingInvitations: PendingInvitation[]
}

function initialsFor(email: string | null): string {
  if (!email) return '?'
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase() || '?'
}

export default function Dashboard({ roles, pendingInvitations }: DashboardProps) {
  const defaultRoleId = roles[0]?.id ? String(roles[0].id) : ''

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage teammates and invitations.</p>
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
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select name="roleId" defaultValue={defaultRoleId}>
                      <SelectTrigger id="invite-role" className="w-full">
                        <SelectValue placeholder="Pick a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.roleId && (
                      <p className="text-sm text-destructive">{errors.roleId}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button type="submit" disabled={processing || roles.length === 0}>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled>Resend</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled variant="destructive">
                      Revoke
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
