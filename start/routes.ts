/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

const InvitationsController = () => import('#controllers/invitations_controller')
const AcceptInvitationController = () => import('#controllers/auth/invitations_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const RolesController = () => import('#controllers/roles_controller')
const ProfileController = () => import('#controllers/profile_controller')
const UsersController = () => import('#controllers/users_controller')
const SuppliersController = () => import('#controllers/suppliers_controller')
const CustomersController = () => import('#controllers/customers_controller')
const MaterialsController = () => import('#controllers/materials_controller')
const ComponentsController = () => import('#controllers/components_controller')
const ProductsController = () => import('#controllers/products_controller')
const ProductCategoriesController = () => import('#controllers/product_categories_controller')
const InventoryController = () => import('#controllers/inventory_controller')
const PurchasesController = () => import('#controllers/purchases_controller')
const JobsController = () => import('#controllers/jobs_controller')
const QuotationsController = () => import('#controllers/quotations_controller')
const SalesController = () => import('#controllers/sales_controller')
const InvoicesController = () => import('#controllers/invoices_controller')
const ReportsController = () => import('#controllers/reports_controller')

router.on('/').renderInertia('home', {}).use(middleware.firstUserSetup()).as('home')

router
  .group(() => {
    router.get('login', [controllers.Session, 'create']).as('session.create')
    router.post('login', [controllers.Session, 'store']).as('session.store')
    router.get('invite/:token', [AcceptInvitationController, 'show']).as('invitation.show')
    router.post('invite/:token', [AcceptInvitationController, 'store']).as('invitation.store')
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy']).as('session.destroy')
    router.get('dashboard', [DashboardController, 'index']).as('dashboard')

    // System area: nav links from the sidebar resolve here. Each route is
    // gated server-side by the same permission as its sidebar nav item.
    router.get('system/roles', [RolesController, 'index']).as('system.roles')
    router.get('system/invitations', [InvitationsController, 'index']).as('system.invitations')
    router.get('system/users', [UsersController, 'index']).as('system.users')
    router
      .post('system/users/:id/roles', [UsersController, 'updateRoles'])
      .as('system.users.update_roles')

    router.post('invitations', [InvitationsController, 'store']).as('invitations.store')
    router
      .post('invitations/:id/resend', [InvitationsController, 'resend'])
      .as('invitations.resend')
    router
      .post('invitations/:id/revoke', [InvitationsController, 'revoke'])
      .as('invitations.revoke')
    router.post('roles', [RolesController, 'store']).as('roles.store')
    router.post('roles/:id/delete', [RolesController, 'destroy']).as('roles.destroy')
    router.get('profile', [ProfileController, 'show']).as('profile.show')
    router.post('profile', [ProfileController, 'update']).as('profile.update')
    router.post('profile/avatar', [ProfileController, 'updateAvatar']).as('profile.avatar.update')
    router
      .post('profile/avatar/delete', [ProfileController, 'destroyAvatar'])
      .as('profile.avatar.destroy')

    // ── Suppliers / Customers ─────────────────────────────────────────
    router.get('suppliers', [SuppliersController, 'index']).as('suppliers.index')
    router.post('suppliers', [SuppliersController, 'store']).as('suppliers.store')
    router.post('suppliers/:id', [SuppliersController, 'update']).as('suppliers.update')
    router.post('suppliers/:id/archive', [SuppliersController, 'archive']).as('suppliers.archive')

    router.get('customers', [CustomersController, 'index']).as('customers.index')
    router.post('customers', [CustomersController, 'store']).as('customers.store')
    router.post('customers/:id', [CustomersController, 'update']).as('customers.update')
    router.post('customers/:id/archive', [CustomersController, 'archive']).as('customers.archive')

    // ── Catalog ───────────────────────────────────────────────────────
    router.get('catalog/materials', [MaterialsController, 'index']).as('materials.index')
    router.post('catalog/materials', [MaterialsController, 'store']).as('materials.store')
    router.post('catalog/materials/:id', [MaterialsController, 'update']).as('materials.update')
    router
      .post('catalog/materials/:id/archive', [MaterialsController, 'archive'])
      .as('materials.archive')

    router.get('catalog/components', [ComponentsController, 'index']).as('components.index')
    router.post('catalog/components', [ComponentsController, 'store']).as('components.store')
    router.post('catalog/components/:id', [ComponentsController, 'update']).as('components.update')
    router
      .post('catalog/components/:id/archive', [ComponentsController, 'archive'])
      .as('components.archive')

    router.get('catalog/products', [ProductsController, 'index']).as('products.index')
    router.post('catalog/products', [ProductsController, 'store']).as('products.store')
    router.post('catalog/products/:id', [ProductsController, 'update']).as('products.update')
    router
      .post('catalog/products/:id/archive', [ProductsController, 'archive'])
      .as('products.archive')

    router
      .get('catalog/categories', [ProductCategoriesController, 'index'])
      .as('product_categories.index')
    router
      .post('catalog/categories', [ProductCategoriesController, 'store'])
      .as('product_categories.store')
    router
      .post('catalog/categories/:id', [ProductCategoriesController, 'update'])
      .as('product_categories.update')
    router
      .post('catalog/categories/:id/delete', [ProductCategoriesController, 'destroy'])
      .as('product_categories.destroy')

    // ── Inventory ─────────────────────────────────────────────────────
    router.get('inventory', [InventoryController, 'index']).as('inventory.index')
    router.post('inventory/adjustments', [InventoryController, 'adjust']).as('inventory.adjust')

    // ── Purchases ─────────────────────────────────────────────────────
    router.get('purchases', [PurchasesController, 'index']).as('purchases.index')
    router.get('purchases/:id', [PurchasesController, 'show']).as('purchases.show')
    router.post('purchases', [PurchasesController, 'store']).as('purchases.store')
    router.post('purchases/:id/confirm', [PurchasesController, 'confirm']).as('purchases.confirm')
    router.post('purchases/:id/cancel', [PurchasesController, 'cancel']).as('purchases.cancel')

    // ── Production jobs ───────────────────────────────────────────────
    router.get('jobs', [JobsController, 'index']).as('jobs.index')
    router.get('jobs/:id', [JobsController, 'show']).as('jobs.show')
    router.post('jobs', [JobsController, 'store']).as('jobs.store')
    router.post('jobs/:id/start', [JobsController, 'start']).as('jobs.start')
    router.post('jobs/:id/consumptions', [JobsController, 'consume']).as('jobs.consume')
    router.post('jobs/:id/expenses', [JobsController, 'addExpense']).as('jobs.expense')
    router.post('jobs/:id/complete', [JobsController, 'complete']).as('jobs.complete')
    router.post('jobs/:id/fail', [JobsController, 'fail']).as('jobs.fail')
    router.post('jobs/:id/cancel', [JobsController, 'cancel']).as('jobs.cancel')

    // ── Quotations ────────────────────────────────────────────────────
    router.get('quotations', [QuotationsController, 'index']).as('quotations.index')
    router.get('quotations/:id', [QuotationsController, 'show']).as('quotations.show')
    router.post('quotations', [QuotationsController, 'store']).as('quotations.store')
    router.post('quotations/:id/send', [QuotationsController, 'send']).as('quotations.send')
    router.post('quotations/:id/accept', [QuotationsController, 'accept']).as('quotations.accept')
    router.post('quotations/:id/reject', [QuotationsController, 'reject']).as('quotations.reject')
    router
      .post('quotations/:id/convert', [QuotationsController, 'convert'])
      .as('quotations.convert')
    router
      .post('quotations/suggest-price', [QuotationsController, 'suggestPrice'])
      .as('quotations.suggest_price')

    // ── Sales ─────────────────────────────────────────────────────────
    router.get('sales', [SalesController, 'index']).as('sales.index')
    router.get('sales/:id', [SalesController, 'show']).as('sales.show')
    router.post('sales', [SalesController, 'store']).as('sales.store')
    router.post('sales/:id/confirm', [SalesController, 'confirm']).as('sales.confirm')
    router.post('sales/:id/cancel', [SalesController, 'cancel']).as('sales.cancel')

    // ── Invoices ──────────────────────────────────────────────────────
    router.get('invoices', [InvoicesController, 'index']).as('invoices.index')
    router.get('invoices/:id', [InvoicesController, 'show']).as('invoices.show')
    router.post('invoices/:id/payments', [InvoicesController, 'pay']).as('invoices.pay')
    router.post('invoices/:id/void', [InvoicesController, 'void']).as('invoices.void')

    // ── Reports ───────────────────────────────────────────────────────
    router.get('reports/profit', [ReportsController, 'profit']).as('reports.profit')
    router.get('reports/inventory', [ReportsController, 'inventory']).as('reports.inventory')
    router.get('reports/jobs', [ReportsController, 'jobs']).as('reports.jobs')
  })
  .use(middleware.auth())
