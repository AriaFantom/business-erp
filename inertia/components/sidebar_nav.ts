import { LayoutDashboard, Mail, Settings2, ShieldCheck, Users, type LucideIcon } from 'lucide-react'

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  /** When set, item is hidden unless `user.permissions` includes this key. */
  permission?: string
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'System',
    url: '#',
    icon: Settings2,
    children: [
      {
        title: 'Role Management',
        url: '/system/roles',
        icon: ShieldCheck,
        permission: 'roles.view',
      },
      {
        title: 'User Invitation',
        url: '/system/invitations',
        icon: Mail,
        permission: 'users.invite',
      },
      {
        title: 'User List',
        url: '/system/users',
        icon: Users,
        permission: 'users.view',
      },
    ],
  },
]
