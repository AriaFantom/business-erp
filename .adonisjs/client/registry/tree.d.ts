/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: typeof routes['health']
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
    restore: typeof routes['materials.restore']
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
    restore: typeof routes['components.restore']
    image: {
      update: typeof routes['components.image.update']
      destroy: typeof routes['components.image.destroy']
    }
  }
  products: {
    index: typeof routes['products.index']
    store: typeof routes['products.store']
    show: typeof routes['products.show']
    update: typeof routes['products.update']
    archive: typeof routes['products.archive']
    restore: typeof routes['products.restore']
    image: {
      update: typeof routes['products.image.update']
      destroy: typeof routes['products.image.destroy']
    }
    files: {
      index: typeof routes['products.files.index']
      upload: typeof routes['products.files.upload']
      download: typeof routes['products.files.download']
      destroy: typeof routes['products.files.destroy']
    }
    qr: typeof routes['products.qr'] & {
      download: typeof routes['products.qr.download']
    }
    defaultPrice: {
      set: typeof routes['products.defaultPrice.set']
      clear: typeof routes['products.defaultPrice.clear']
    }
    images: {
      upload: typeof routes['products.images.upload']
      setPrimary: typeof routes['products.images.setPrimary']
      reorder: typeof routes['products.images.reorder']
    }
  }
  productCategories: {
    index: typeof routes['product_categories.index']
    store: typeof routes['product_categories.store']
    update: typeof routes['product_categories.update']
    archive: typeof routes['product_categories.archive']
    restore: typeof routes['product_categories.restore']
  }
  inventory: {
    index: typeof routes['inventory.index']
    adjust: typeof routes['inventory.adjust']
  }
  stockTakes: {
    index: typeof routes['stockTakes.index']
    store: typeof routes['stockTakes.store']
    show: typeof routes['stockTakes.show']
    saveCounts: typeof routes['stockTakes.saveCounts']
    refresh: typeof routes['stockTakes.refresh']
    complete: typeof routes['stockTakes.complete']
    cancel: typeof routes['stockTakes.cancel']
  }
  purchases: {
    index: typeof routes['purchases.index']
    show: typeof routes['purchases.show']
    store: typeof routes['purchases.store']
    confirm: typeof routes['purchases.confirm']
    cancel: typeof routes['purchases.cancel']
    returns: {
      store: typeof routes['purchases.returns.store']
    }
    payments: {
      store: typeof routes['purchases.payments.store']
    }
  }
  jobs: {
    index: typeof routes['jobs.index']
    show: typeof routes['jobs.show']
    store: typeof routes['jobs.store']
    start: typeof routes['jobs.start']
    pause: typeof routes['jobs.pause']
    resume: typeof routes['jobs.resume']
    skipStage: typeof routes['jobs.skipStage']
    consume: typeof routes['jobs.consume']
    expense: typeof routes['jobs.expense']
    confirm: typeof routes['jobs.confirm']
    fail: typeof routes['jobs.fail']
    cancel: typeof routes['jobs.cancel']
  }
  machines: {
    index: typeof routes['machines.index']
    new: typeof routes['machines.new']
    store: typeof routes['machines.store']
    show: typeof routes['machines.show']
    update: typeof routes['machines.update']
    retire: typeof routes['machines.retire']
    maintenance: typeof routes['machines.maintenance']
    expense: typeof routes['machines.expense']
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
    download: typeof routes['quotations.download']
  }
  sales: {
    index: typeof routes['sales.index']
    show: typeof routes['sales.show']
    store: typeof routes['sales.store']
    confirm: typeof routes['sales.confirm']
    cancel: typeof routes['sales.cancel']
    returns: {
      store: typeof routes['sales.returns.store']
    }
  }
  invoices: {
    index: typeof routes['invoices.index']
    show: typeof routes['invoices.show']
    pay: typeof routes['invoices.pay']
    void: typeof routes['invoices.void']
    download: typeof routes['invoices.download']
  }
  pos: {
    index: typeof routes['pos.index']
    sell: typeof routes['pos.sell']
    session: {
      open: typeof routes['pos.session.open']
      close: typeof routes['pos.session.close']
    }
  }
  reports: {
    profit: typeof routes['reports.profit']
    inventory: typeof routes['reports.inventory']
    jobs: typeof routes['reports.jobs']
  }
}
