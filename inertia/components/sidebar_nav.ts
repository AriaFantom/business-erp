import {
  Box,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  HardHat,
  LayoutDashboard,
  MonitorPlay,
  Mail,
  Package,
  Cpu as MachineIcon,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
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
  /** When set, item is hidden unless this module is enabled for the install. */
  module?: string
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  {
    title: 'Overview',
    url: '#',
    icon: LayoutDashboard,
    children: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Profit Report',
        url: '/reports/profit',
        icon: ClipboardList,
        permission: 'reports.view',
        module: 'reports',
      },
      {
        title: 'Inventory Report',
        url: '/reports/inventory',
        icon: Warehouse,
        permission: 'reports.view',
        module: 'reports',
      },
      {
        title: 'Jobs Report',
        url: '/reports/jobs',
        icon: Factory,
        permission: 'reports.view',
        module: 'reports',
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
    title: 'Procurement',
    url: '#',
    icon: Truck,
    children: [
      {
        title: 'Suppliers',
        url: '/suppliers',
        icon: Truck,
        permission: 'suppliers.view',
        module: 'purchase',
      },
      {
        title: 'Purchases',
        url: '/purchases',
        icon: ShoppingCart,
        permission: 'purchases.view',
        module: 'purchase',
      },
      {
        title: 'Inventory',
        url: '/inventory',
        icon: Warehouse,
        permission: 'inventory.view',
        module: 'inventory',
      },
    ],
  },
  {
    title: 'Production',
    url: '#',
    icon: Factory,
    children: [
      {
        title: 'Floor',
        url: '/production/floor',
        icon: MonitorPlay,
        permission: 'jobs.view',
        module: 'manufacturing',
      },
      {
        title: 'Jobs',
        url: '/jobs',
        icon: Factory,
        permission: 'jobs.view',
        module: 'manufacturing',
      },
      {
        title: 'Machines',
        url: '/machines',
        icon: MachineIcon,
        permission: 'machines.view',
        module: 'machines',
      },
      {
        title: 'Workers',
        url: '/workers',
        icon: HardHat,
        permission: 'workers.view',
        module: 'labour',
      },
    ],
  },
  {
    title: 'Sales',
    url: '#',
    icon: ShoppingCart,
    children: [
      {
        title: 'POS',
        url: '/pos',
        icon: Store,
        permission: 'pos.view',
        module: 'pos',
      },
      {
        title: 'Quotations',
        url: '/quotations',
        icon: FileText,
        permission: 'quotations.view',
        module: 'quotations',
      },
      {
        title: 'Orders',
        url: '/orders',
        icon: ScrollText,
        permission: 'orders.view',
        module: 'orders',
      },
      {
        title: 'Invoices',
        url: '/invoices',
        icon: Receipt,
        permission: 'invoices.view',
        module: 'invoices',
      },
      {
        title: 'Customers',
        url: '/customers',
        icon: UserSquare,
        permission: 'customers.view',
        module: 'orders',
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
      {
        title: 'Modules',
        url: '/system/modules',
        icon: SlidersHorizontal,
        permission: 'settings.view',
      },
    ],
  },
]
