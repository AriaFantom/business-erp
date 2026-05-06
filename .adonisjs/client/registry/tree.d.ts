/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  invitation: {
    show: typeof routes['invitation.show']
    store: typeof routes['invitation.store']
  }
  dashboard: typeof routes['dashboard']
  system: {
    roles: typeof routes['system.roles']
    invitations: typeof routes['system.invitations']
    users: typeof routes['system.users'] & {
      updateRoles: typeof routes['system.users.update_roles']
    }
  }
  invitations: {
    store: typeof routes['invitations.store']
    resend: typeof routes['invitations.resend']
    revoke: typeof routes['invitations.revoke']
  }
  roles: {
    store: typeof routes['roles.store']
    destroy: typeof routes['roles.destroy']
  }
  profile: {
    show: typeof routes['profile.show']
    update: typeof routes['profile.update']
    avatar: {
      update: typeof routes['profile.avatar.update']
      destroy: typeof routes['profile.avatar.destroy']
    }
  }
  suppliers: {
    index: typeof routes['suppliers.index']
    store: typeof routes['suppliers.store']
    update: typeof routes['suppliers.update']
    archive: typeof routes['suppliers.archive']
  }
  customers: {
    index: typeof routes['customers.index']
    store: typeof routes['customers.store']
    update: typeof routes['customers.update']
    archive: typeof routes['customers.archive']
  }
  materials: {
    index: typeof routes['materials.index']
    store: typeof routes['materials.store']
    update: typeof routes['materials.update']
    archive: typeof routes['materials.archive']
    image: {
      update: typeof routes['materials.image.update']
      destroy: typeof routes['materials.image.destroy']
    }
  }
  components: {
    index: typeof routes['components.index']
    store: typeof routes['components.store']
    update: typeof routes['components.update']
    archive: typeof routes['components.archive']
    image: {
      update: typeof routes['components.image.update']
      destroy: typeof routes['components.image.destroy']
    }
  }
  products: {
    index: typeof routes['products.index']
    store: typeof routes['products.store']
    update: typeof routes['products.update']
    archive: typeof routes['products.archive']
    image: {
      update: typeof routes['products.image.update']
      destroy: typeof routes['products.image.destroy']
    }
  }
  productCategories: {
    index: typeof routes['product_categories.index']
    store: typeof routes['product_categories.store']
    update: typeof routes['product_categories.update']
    destroy: typeof routes['product_categories.destroy']
  }
  inventory: {
    index: typeof routes['inventory.index']
    adjust: typeof routes['inventory.adjust']
  }
  purchases: {
    index: typeof routes['purchases.index']
    show: typeof routes['purchases.show']
    store: typeof routes['purchases.store']
    confirm: typeof routes['purchases.confirm']
    cancel: typeof routes['purchases.cancel']
  }
  jobs: {
    index: typeof routes['jobs.index']
    show: typeof routes['jobs.show']
    store: typeof routes['jobs.store']
    start: typeof routes['jobs.start']
    consume: typeof routes['jobs.consume']
    expense: typeof routes['jobs.expense']
    complete: typeof routes['jobs.complete']
    fail: typeof routes['jobs.fail']
    cancel: typeof routes['jobs.cancel']
  }
  quotations: {
    index: typeof routes['quotations.index']
    show: typeof routes['quotations.show']
    store: typeof routes['quotations.store']
    send: typeof routes['quotations.send']
    accept: typeof routes['quotations.accept']
    reject: typeof routes['quotations.reject']
    convert: typeof routes['quotations.convert']
    suggestPrice: typeof routes['quotations.suggest_price']
  }
  sales: {
    index: typeof routes['sales.index']
    show: typeof routes['sales.show']
    store: typeof routes['sales.store']
    confirm: typeof routes['sales.confirm']
    cancel: typeof routes['sales.cancel']
  }
  invoices: {
    index: typeof routes['invoices.index']
    show: typeof routes['invoices.show']
    pay: typeof routes['invoices.pay']
    void: typeof routes['invoices.void']
  }
  pos: {
    index: typeof routes['pos.index']
    sell: typeof routes['pos.sell']
  }
  reports: {
    profit: typeof routes['reports.profit']
    inventory: typeof routes['reports.inventory']
    jobs: typeof routes['reports.jobs']
  }
}
