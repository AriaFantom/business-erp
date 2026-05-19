import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'auth/invitation': ExtractProps<(typeof import('../../inertia/pages/auth/invitation.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'catalog/categories': ExtractProps<(typeof import('../../inertia/pages/catalog/categories.tsx'))['default']>
    'catalog/components': ExtractProps<(typeof import('../../inertia/pages/catalog/components.tsx'))['default']>
    'catalog/materials': ExtractProps<(typeof import('../../inertia/pages/catalog/materials.tsx'))['default']>
    'catalog/products': ExtractProps<(typeof import('../../inertia/pages/catalog/products.tsx'))['default']>
    'catalog/products/show': ExtractProps<(typeof import('../../inertia/pages/catalog/products/show.tsx'))['default']>
    'customers/index': ExtractProps<(typeof import('../../inertia/pages/customers/index.tsx'))['default']>
    'dashboard': ExtractProps<(typeof import('../../inertia/pages/dashboard.tsx'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.tsx'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.tsx'))['default']>
    'inventory/index': ExtractProps<(typeof import('../../inertia/pages/inventory/index.tsx'))['default']>
    'invoices/index': ExtractProps<(typeof import('../../inertia/pages/invoices/index.tsx'))['default']>
    'invoices/show': ExtractProps<(typeof import('../../inertia/pages/invoices/show.tsx'))['default']>
    'jobs/index': ExtractProps<(typeof import('../../inertia/pages/jobs/index.tsx'))['default']>
    'jobs/show': ExtractProps<(typeof import('../../inertia/pages/jobs/show.tsx'))['default']>
    'pos/index': ExtractProps<(typeof import('../../inertia/pages/pos/index.tsx'))['default']>
    'printers/index': ExtractProps<(typeof import('../../inertia/pages/printers/index.tsx'))['default']>
    'printers/new': ExtractProps<(typeof import('../../inertia/pages/printers/new.tsx'))['default']>
    'printers/show': ExtractProps<(typeof import('../../inertia/pages/printers/show.tsx'))['default']>
    'profile/edit': ExtractProps<(typeof import('../../inertia/pages/profile/edit.tsx'))['default']>
    'purchases/index': ExtractProps<(typeof import('../../inertia/pages/purchases/index.tsx'))['default']>
    'purchases/show': ExtractProps<(typeof import('../../inertia/pages/purchases/show.tsx'))['default']>
    'quotations/index': ExtractProps<(typeof import('../../inertia/pages/quotations/index.tsx'))['default']>
    'quotations/show': ExtractProps<(typeof import('../../inertia/pages/quotations/show.tsx'))['default']>
    'reports/inventory': ExtractProps<(typeof import('../../inertia/pages/reports/inventory.tsx'))['default']>
    'reports/jobs': ExtractProps<(typeof import('../../inertia/pages/reports/jobs.tsx'))['default']>
    'reports/profit': ExtractProps<(typeof import('../../inertia/pages/reports/profit.tsx'))['default']>
    'sales/index': ExtractProps<(typeof import('../../inertia/pages/sales/index.tsx'))['default']>
    'sales/show': ExtractProps<(typeof import('../../inertia/pages/sales/show.tsx'))['default']>
    'suppliers/index': ExtractProps<(typeof import('../../inertia/pages/suppliers/index.tsx'))['default']>
    'system/invitations': ExtractProps<(typeof import('../../inertia/pages/system/invitations.tsx'))['default']>
    'system/roles': ExtractProps<(typeof import('../../inertia/pages/system/roles.tsx'))['default']>
    'system/users': ExtractProps<(typeof import('../../inertia/pages/system/users.tsx'))['default']>
  }
}
