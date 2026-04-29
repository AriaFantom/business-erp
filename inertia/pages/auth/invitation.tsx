import { useState } from 'react'
import { Info, MoreHorizontal, Send } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type InviteRole = 'Admin' | 'Member' | 'Viewer'
type InviteStatus = 'Pending' | 'Accepted'
type Invite = {
  id: string
  email: string
  role: InviteRole
  sent: string
  status: InviteStatus
}

export default function Invitation() {
  const [email, setEmail] = useState<string>('')
  const [role, setRole] = useState<InviteRole>('Member')
  const [invites, setInvites] = useState<Invite[]>([
    {
      id: crypto.randomUUID(),
      email: 'alex@layerdreams.com',
      role: 'Admin',
      sent: '2 days ago',
      status: 'Accepted',
    },
    {
      id: crypto.randomUUID(),
      email: 'mira@layerdreams.com',
      role: 'Member',
      sent: '1 day ago',
      status: 'Pending',
    },
    {
      id: crypto.randomUUID(),
      email: 'sam@layerdreams.com',
      role: 'Viewer',
      sent: '3 hours ago',
      status: 'Pending',
    },
  ])

  const [fullName, setFullName] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [agreed, setAgreed] = useState<boolean>(false)

  const handleSendInvite = () => {
    if (!email.trim()) return
    const next: Invite = {
      id: crypto.randomUUID(),
      email: email.trim(),
      role,
      sent: 'Just now',
      status: 'Pending',
    }
    setInvites((prev) => [next, ...prev])
    setEmail('')
  }

  const acceptDisabled = !agreed || fullName.trim().length === 0 || password.length === 0

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <Tabs defaultValue="send">
        <TabsList className="w-full">
          <TabsTrigger value="send">Send invites</TabsTrigger>
          <TabsTrigger value="accept">Accept invitation</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Invite teammates</CardTitle>
              <CardDescription>
                Send an email invite to give someone access to your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Select value={role} onValueChange={(value) => setRole(value as InviteRole)}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Member">Member</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                {/* TODO: wire up to invitations controller (e.g. router.post('/invitations')) */}
                <Button onClick={handleSendInvite}>
                  <Send />
                  Send invite
                </Button>
              </div>

              <Separator />

              {invites.length === 0 ? (
                <Alert>
                  <Info />
                  <AlertTitle>No invitations yet</AlertTitle>
                  <AlertDescription>
                    No invitations yet — send your first one above.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead aria-label="Actions" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>
                          <Badge variant={invite.role === 'Admin' ? 'default' : 'secondary'}>
                            {invite.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{invite.sent}</TableCell>
                        <TableCell>
                          <Badge variant={invite.status === 'Pending' ? 'outline' : 'default'}>
                            {invite.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Open invite actions">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Resend invite</DropdownMenuItem>
                              <DropdownMenuItem>Copy invite link</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive">Revoke</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accept" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <CardTitle>Jane Doe invited you</CardTitle>
                  <CardDescription>Join Layerdreams Workspace</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invitation-name">Full name</Label>
                  <Input
                    id="invitation-name"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invitation-password">Password</Label>
                  <Input
                    id="invitation-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="invitation-terms"
                    checked={agreed}
                    onCheckedChange={(value) => setAgreed(value === true)}
                  />
                  <Label htmlFor="invitation-terms" className="font-normal">
                    I agree to the Terms of Service and Privacy Policy
                  </Label>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3 sm:items-center">
              <Button type="button" disabled={acceptDisabled} className="w-full sm:w-auto">
                Accept &amp; create account
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Decline invitation
              </button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
