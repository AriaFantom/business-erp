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
const MachinesController = () => import('#controllers/machines_controller')
const QuotationsController = () => import('#controllers/quotations_controller')
const SalesController = () => import('#controllers/sales_controller')
const InvoicesController = () => import('#controllers/invoices_controller')
const ReportsController = () => import('#controllers/reports_controller')
const PosController = () => import('#controllers/pos_controller')
const RootController = () => import('#controllers/root_controller')

router.get('/health', ({ response }) => response.ok({ status: 'ok' })).as('health')

router.get('/', [RootController, 'index']).use(middleware.firstUserSetup()).as('home')

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
    router
      .post('catalog/materials/:id/restore', [MaterialsController, 'restore'])
      .as('materials.restore')
    router
      .post('catalog/materials/:id/image', [MaterialsController, 'updateImage'])
      .as('materials.image.update')
    router
      .post('catalog/materials/:id/image/delete', [MaterialsController, 'destroyImage'])
      .as('materials.image.destroy')

    router.get('catalog/components', [ComponentsController, 'index']).as('components.index')
    router.post('catalog/components', [ComponentsController, 'store']).as('components.store')
    router.post('catalog/components/:id', [ComponentsController, 'update']).as('components.update')
    router
      .post('catalog/components/:id/archive', [ComponentsController, 'archive'])
      .as('components.archive')
    router
      .post('catalog/components/:id/restore', [ComponentsController, 'restore'])
      .as('components.restore')
    router
      .post('catalog/components/:id/image', [ComponentsController, 'updateImage'])
      .as('components.image.update')
    router
      .post('catalog/components/:id/image/delete', [ComponentsController, 'destroyImage'])
      .as('components.image.destroy')

    router.get('catalog/products', [ProductsController, 'index']).as('products.index')
    router.post('catalog/products', [ProductsController, 'store']).as('products.store')
    router.get('catalog/products/:id', [ProductsController, 'show']).as('products.show')
    router.post('catalog/products/:id', [ProductsController, 'update']).as('products.update')
    router
      .post('catalog/products/:id/archive', [ProductsController, 'archive'])
      .as('products.archive')
    router
      .post('catalog/products/:id/restore', [ProductsController, 'restore'])
      .as('products.restore')
    router
      .post('catalog/products/:id/image', [ProductsController, 'updateImage'])
      .as('products.image.update')
    router
      .post('catalog/products/:id/image/delete', [ProductsController, 'destroyImage'])
      .as('products.image.destroy')
    router
      .get('catalog/products/:id/files', [ProductsController, 'listFiles'])
      .as('products.files.index')
    router
      .post('catalog/products/:id/files', [ProductsController, 'uploadFile'])
      .as('products.files.upload')
    router
      .get('catalog/products/:id/files/:fileId/download', [ProductsController, 'downloadFile'])
      .as('products.files.download')
    router
      .post('catalog/products/:id/files/:fileId/delete', [ProductsController, 'destroyFile'])
      .as('products.files.destroy')
    router.get('catalog/products/:id/qr', [ProductsController, 'qr']).as('products.qr')
    router
      .get('catalog/products/:id/qr/download', [ProductsController, 'qrDownload'])
      .as('products.qr.download')
    router
      .post('catalog/products/:id/default-price', [ProductsController, 'setDefaultPrice'])
      .as('products.defaultPrice.set')
    router
      .post('catalog/products/:id/default-price/delete', [ProductsController, 'clearDefaultPrice'])
      .as('products.defaultPrice.clear')
    router
      .post('catalog/products/:id/images', [ProductsController, 'uploadImages'])
      .as('products.images.upload')
    router
      .post('catalog/products/:id/images/:imageId/primary', [ProductsController, 'setPrimaryImage'])
      .as('products.images.setPrimary')
    router
      .post('catalog/products/:id/images/reorder', [ProductsController, 'reorderImages'])
      .as('products.images.reorder')

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
      .post('catalog/categories/:id/archive', [ProductCategoriesController, 'archive'])
      .as('product_categories.archive')
    router
      .post('catalog/categories/:id/restore', [ProductCategoriesController, 'restore'])
      .as('product_categories.restore')

    // ── Inventory ─────────────────────────────────────────────────────
    router.get('inventory', [InventoryController, 'index']).as('inventory.index')
    router.post('inventory/adjustments', [InventoryController, 'adjust']).as('inventory.adjust')

    // ── Purchases ─────────────────────────────────────────────────────
    router.get('purchases', [PurchasesController, 'index']).as('purchases.index')
    router.get('purchases/:id', [PurchasesController, 'show']).as('purchases.show')
    router.post('purchases', [PurchasesController, 'store']).as('purchases.store')
    router.post('purchases/:id/confirm', [PurchasesController, 'confirm']).as('purchases.confirm')
    router.post('purchases/:id/cancel', [PurchasesController, 'cancel']).as('purchases.cancel')
    router
      .post('purchases/:id/returns', [PurchasesController, 'storeReturn'])
      .as('purchases.returns.store')

    // ── Production jobs ───────────────────────────────────────────────
    router.get('jobs', [JobsController, 'index']).as('jobs.index')
    router.get('jobs/:id', [JobsController, 'show']).as('jobs.show')
    router.post('jobs', [JobsController, 'store']).as('jobs.store')
    router.post('jobs/:id/start', [JobsController, 'start']).as('jobs.start')
    router.post('jobs/:id/pause', [JobsController, 'pause']).as('jobs.pause')
    router.post('jobs/:id/resume', [JobsController, 'resume']).as('jobs.resume')
    router.post('jobs/:id/skip-stage', [JobsController, 'skipStage']).as('jobs.skipStage')
    router.post('jobs/:id/consumptions', [JobsController, 'consume']).as('jobs.consume')
    router.post('jobs/:id/expenses', [JobsController, 'addExpense']).as('jobs.expense')
    router.post('jobs/:id/confirm', [JobsController, 'confirm']).as('jobs.confirm')
    router.post('jobs/:id/fail', [JobsController, 'fail']).as('jobs.fail')
    router.post('jobs/:id/cancel', [JobsController, 'cancel']).as('jobs.cancel')

    // ── Machines ──────────────────────────────────────────────────────
    router.get('machines', [MachinesController, 'index']).as('machines.index')
    router.get('machines/new', [MachinesController, 'create']).as('machines.new')
    router.post('machines', [MachinesController, 'store']).as('machines.store')
    router.get('machines/:id', [MachinesController, 'show']).as('machines.show')
    router.post('machines/:id', [MachinesController, 'update']).as('machines.update')
    router.post('machines/:id/retire', [MachinesController, 'retire']).as('machines.retire')
    router
      .post('machines/:id/maintenance', [MachinesController, 'toggleMaintenance'])
      .as('machines.maintenance')
    router.post('machines/:id/expense', [MachinesController, 'addExpense']).as('machines.expense')

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
    router
      .get('quotations/:id/download', [QuotationsController, 'download'])
      .as('quotations.download')

    // ── Sales ─────────────────────────────────────────────────────────
    router.get('sales', [SalesController, 'index']).as('sales.index')
    router.get('sales/:id', [SalesController, 'show']).as('sales.show')
    router.post('sales', [SalesController, 'store']).as('sales.store')
    router.post('sales/:id/confirm', [SalesController, 'confirm']).as('sales.confirm')
    router.post('sales/:id/cancel', [SalesController, 'cancel']).as('sales.cancel')
    router.post('sales/:id/returns', [SalesController, 'storeReturn']).as('sales.returns.store')

    // ── Invoices ──────────────────────────────────────────────────────
    router.get('invoices', [InvoicesController, 'index']).as('invoices.index')
    router.get('invoices/:id', [InvoicesController, 'show']).as('invoices.show')
    router.post('invoices/:id/payments', [InvoicesController, 'pay']).as('invoices.pay')
    router.post('invoices/:id/void', [InvoicesController, 'void']).as('invoices.void')
    router.get('invoices/:id/download', [InvoicesController, 'download']).as('invoices.download')

    // ── POS ──────────────────────────────────────────────────────────
    router.get('pos', [PosController, 'index']).as('pos.index')
    router.post('pos/sell', [PosController, 'sell']).as('pos.sell')

    // ── Reports ───────────────────────────────────────────────────────
    router.get('reports/profit', [ReportsController, 'profit']).as('reports.profit')
    router.get('reports/inventory', [ReportsController, 'inventory']).as('reports.inventory')
    router.get('reports/jobs', [ReportsController, 'jobs']).as('reports.jobs')
  })
  .use(middleware.auth())
