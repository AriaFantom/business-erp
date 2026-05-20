import {
  Box,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  Mail,
  Package,
  Cpu as MachineIcon,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Users,
  UserSquare,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'

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
    url: '#',
    icon: LayoutDashboard,
    children: [
      {
        title: 'Overview',
        url: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Profit Report',
        url: '/reports/profit',
        icon: ClipboardList,
        permission: 'reports.view',
      },
      {
        title: 'Inventory Report',
        url: '/reports/inventory',
        icon: Warehouse,
        permission: 'reports.view',
      },
      {
        title: 'Jobs Report',
        url: '/reports/jobs',
        icon: Factory,
        permission: 'reports.view',
      },
    ],
  },
  {
    title: 'Catalog',
    url: '#',
    icon: Box,
    children: [
      {
        title: 'Products',
        url: '/catalog/products',
        icon: Package,
        permission: 'products.view',
      },
      {
        title: 'Materials',
        url: '/catalog/materials',
        icon: Boxes,
        permission: 'materials.view',
      },
      {
        title: 'Components',
        url: '/catalog/components',
        icon: Boxes,
        permission: 'components.view',
      },
      {
        title: 'Categories',
        url: '/catalog/categories',
        icon: Tags,
        permission: 'productCategories.view',
      },
    ],
  },
  {
    title: 'Inventory',
    url: '/inventory',
    icon: Warehouse,
    permission: 'inventory.view',
  },
  {
    title: 'Purchases',
    url: '/purchases',
    icon: Truck,
    permission: 'purchases.view',
  },
  {
    title: 'Production',
    url: '/jobs',
    icon: Factory,
    permission: 'jobs.view',
  },
  {
    title: 'Machines',
    url: '/machines',
    icon: MachineIcon,
    permission: 'machines.view',
  },
  {
    title: 'POS',
    url: '/pos',
    icon: Store,
    permission: 'pos.view',
  },
  {
    title: 'Sales',
    url: '#',
    icon: ShoppingCart,
    children: [
      {
        title: 'Quotations',
        url: '/quotations',
        icon: FileText,
        permission: 'quotations.view',
      },
      {
        title: 'Sales',
        url: '/sales',
        icon: ScrollText,
        permission: 'sales.view',
      },
      {
        title: 'Invoices',
        url: '/invoices',
        icon: Receipt,
        permission: 'invoices.view',
      },
    ],
  },
  {
    title: 'Contacts',
    url: '#',
    icon: UserSquare,
    children: [
      {
        title: 'Suppliers',
        url: '/suppliers',
        icon: Truck,
        permission: 'suppliers.view',
      },
      {
        title: 'Customers',
        url: '/customers',
        icon: UserSquare,
        permission: 'customers.view',
      },
    ],
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
