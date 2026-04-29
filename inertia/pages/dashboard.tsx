import {
  Activity,
  DollarSign,
  MoreHorizontal,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type StatTrend = 'up' | 'down'

type Stat = {
  label: string
  value: string
  change: string
  trend: StatTrend
  icon: typeof Users
}

type ActivityStatus = 'success' | 'info' | 'pending' | 'failed'

type ActivityRow = {
  id: string
  name: string
  initials: string
  action: string
  status: ActivityStatus
  statusLabel: string
  time: string
}

type Invite = {
  id: string
  email: string
  initials: string
  role: string
}

const stats: Stat[] = [
  {
    label: 'Total users',
    value: '1,284',
    change: '+8.2% from last week',
    trend: 'up',
    icon: Users,
  },
  {
    label: 'Active sessions',
    value: '342',
    change: '+14.1% from last week',
    trend: 'up',
    icon: Activity,
  },
  {
    label: 'Revenue',
    value: '$24,580',
    change: '+3.7% from last week',
    trend: 'up',
    icon: DollarSign,
  },
  {
    label: 'Conversion',
    value: '4.6%',
    change: '-0.4% from last week',
    trend: 'down',
    icon: TrendingUp,
  },
]

const activities: ActivityRow[] = [
  {
    id: 'a1',
    name: 'Maya Chen',
    initials: 'MC',
    action: 'Deployed production build',
    status: 'success',
    statusLabel: 'Success',
    time: '2m ago',
  },
  {
    id: 'a2',
    name: 'Jordan Patel',
    initials: 'JP',
    action: 'Updated billing settings',
    status: 'info',
    statusLabel: 'Updated',
    time: '18m ago',
  },
  {
    id: 'a3',
    name: 'Riley Adams',
    initials: 'RA',
    action: 'Invited a new teammate',
    status: 'pending',
    statusLabel: 'Pending',
    time: '1h ago',
  },
  {
    id: 'a4',
    name: 'Sam Okafor',
    initials: 'SO',
    action: 'Rotated API credentials',
    status: 'success',
    statusLabel: 'Success',
    time: '3h ago',
  },
  {
    id: 'a5',
    name: 'Taylor Nguyen',
    initials: 'TN',
    action: 'Webhook delivery to /events',
    status: 'failed',
    statusLabel: 'Failed',
    time: '5h ago',
  },
]

const invites: Invite[] = [
  {
    id: 'i1',
    email: 'avery.johnson@layerdreams.io',
    initials: 'AJ',
    role: 'Admin',
  },
  {
    id: 'i2',
    email: 'noah.kim@layerdreams.io',
    initials: 'NK',
    role: 'Developer',
  },
  {
    id: 'i3',
    email: 'priya.shah@layerdreams.io',
    initials: 'PS',
    role: 'Billing',
  },
  {
    id: 'i4',
    email: 'lucas.martin@layerdreams.io',
    initials: 'LM',
    role: 'Viewer',
  },
]

const statusVariant: Record<
  ActivityStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  success: 'default',
  info: 'secondary',
  pending: 'outline',
  failed: 'destructive',
}

export default function Dashboard() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back. Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <Button>
          <Plus />
          New project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-sm">
                  {stat.label}
                </CardDescription>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="text-2xl font-semibold">{stat.value}</div>
                <Badge
                  variant={stat.trend === 'down' ? 'outline' : 'secondary'}
                  className="w-fit"
                >
                  {stat.change}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Latest events across your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{row.initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.action}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[row.status]}>
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.time}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
            <CardDescription>Awaiting response</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{invite.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {invite.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
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
                    <DropdownMenuItem>Resend</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      Revoke
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full">
              View all invites
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
