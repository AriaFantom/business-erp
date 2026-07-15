// start/permissions.ts
import { definePermissions } from '#permissions/define_permissions'

export const permissions = definePermissions({
  users: {
    view: 'View user list',
    invite: 'Send invitations to new users',
    update: 'Edit user details',
    remove: { description: 'Delete users', aliases: ['users.delete'] },
    assignRole: 'Assign roles to users',
  },
  roles: {
    view: 'View roles',
    create: 'Create new roles',
    update: 'Edit existing roles',
    delete: 'Delete roles',
  },
  invitations: {
    view: 'View pending invitations',
    resend: 'Re-send invitation emails',
    revoke: 'Cancel pending invitations',
  },

  // ── Catalog & Inventory ──────────────────────────────────────────────
  inventory: {
    view: 'View on-hand inventory and stock movements',
    adjust: 'Manually adjust inventory levels',
    stockTake: 'Create, count and complete stock-take sessions',
  },
  materials: {
    view: 'View materials',
    create: 'Create materials',
    update: 'Edit materials',
    archive: 'Archive (deactivate) materials',
  },
  components: {
    view: 'View components',
    create: 'Create components',
    update: 'Edit components',
    archive: 'Archive (deactivate) components',
  },
  products: {
    view: 'View products',
    create: 'Create products',
    update: 'Edit products',
    archive: 'Archive (deactivate) products',
  },
  productCategories: {
    view: 'View product categories',
    create: 'Create product categories',
    update: 'Edit product categories',
    delete: 'Delete product categories',
  },
  suppliers: {
    view: 'View suppliers',
    create: 'Create suppliers',
    update: 'Edit suppliers',
    archive: 'Archive (deactivate) suppliers',
  },
  customers: {
    view: 'View customers',
    create: 'Create customers',
    update: 'Edit customers',
    archive: 'Archive (deactivate) customers',
  },

  // ── Purchases ────────────────────────────────────────────────────────
  purchases: {
    view: 'View purchases',
    create: 'Create / edit draft purchases',
    confirm: 'Confirm a purchase (writes stock movements)',
    cancel: 'Cancel a draft purchase',
    return: 'Return items from a confirmed purchase (debit note)',
    pay: 'Record supplier payments against a purchase',
  },

  // ── Production ───────────────────────────────────────────────────────
  jobs: {
    view: 'View production jobs',
    create: 'Create / edit draft jobs',
    consumeMaterial: 'Record material/component consumption on a job',
    addExpense: 'Record expenses against a job',
    complete: 'Move a job to completed/failed',
    cancel: 'Cancel a draft job',
  },
  machines: {
    view: 'View machines',
    create: 'Add a new machine',
    edit: 'Edit machine details and record expenses',
    retire: 'Retire a machine',
  },

  // ── Sales ────────────────────────────────────────────────────────────
  quotations: {
    view: 'View quotations',
    create: 'Create / edit draft quotations',
    send: 'Send a quotation to the customer',
    accept: 'Mark a quotation as accepted',
    reject: 'Mark a quotation as rejected',
    convertToOrder: {
      description: 'Convert an accepted quotation into an order',
      aliases: ['quotations.convertToSale'],
    },
  },
  orders: {
    view: { description: 'View orders', aliases: ['sales.view'] },
    create: { description: 'Create / edit draft orders', aliases: ['sales.create'] },
    confirm: { description: 'Confirm an order (issues an invoice)', aliases: ['sales.confirm'] },
    cancel: { description: 'Cancel a draft order', aliases: ['sales.cancel'] },
    overridePrice: {
      description: 'Override the suggested unit price on POS/manual orders',
      aliases: ['sales.overridePrice'],
    },
    return: {
      description: 'Return sold items and issue a credit note/refund',
      aliases: ['sales.return'],
    },
  },
  invoices: {
    view: 'View invoices',
    generate: 'Generate (issue) an invoice',
    recordPayment: 'Record a payment against an invoice',
    void: 'Void an invoice',
  },

  // ── POS (point-of-sale) ──────────────────────────────────────────────
  pos: {
    view: 'Open the point-of-sale terminal',
    sell: 'Complete a POS sale (creates order + invoice + payment)',
    manageSession: 'Open and close cash register sessions (Z-report)',
  },

  // ── Reports ──────────────────────────────────────────────────────────
  reports: {
    view: 'View profit / inventory / job reports',
  },
})

export type AppPermissions = typeof permissions
