import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'health': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitation.store': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'system.roles': { paramsTuple?: []; params?: {} }
    'system.invitations': { paramsTuple?: []; params?: {} }
    'system.users': { paramsTuple?: []; params?: {} }
    'system.users.update_roles': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.store': { paramsTuple?: []; params?: {} }
    'invitations.resend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.revoke': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'settings.modules': { paramsTuple?: []; params?: {} }
    'settings.modules.update': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.destroy': { paramsTuple?: []; params?: {} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'customers.store': { paramsTuple?: []; params?: {} }
    'customers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.index': { paramsTuple?: []; params?: {} }
    'materials.store': { paramsTuple?: []; params?: {} }
    'materials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.image.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.image.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.index': { paramsTuple?: []; params?: {} }
    'components.store': { paramsTuple?: []; params?: {} }
    'components.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.image.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.image.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.image.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.image.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.upload': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.download': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'fileId': ParamValue} }
    'products.files.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'fileId': ParamValue} }
    'products.qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.qr.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.defaultPrice.set': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.defaultPrice.clear': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.images.upload': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.images.setPrimary': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'imageId': ParamValue} }
    'products.images.reorder': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.index': { paramsTuple?: []; params?: {} }
    'product_categories.store': { paramsTuple?: []; params?: {} }
    'product_categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'inventory.index': { paramsTuple?: []; params?: {} }
    'inventory.adjust': { paramsTuple?: []; params?: {} }
    'purchases.index': { paramsTuple?: []; params?: {} }
    'purchases.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'purchases.store': { paramsTuple?: []; params?: {} }
    'purchases.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'purchases.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.index': { paramsTuple?: []; params?: {} }
    'jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.store': { paramsTuple?: []; params?: {} }
    'jobs.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.pause': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.resume': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.skipStage': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.consume': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.expense': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.fail': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.index': { paramsTuple?: []; params?: {} }
    'machines.new': { paramsTuple?: []; params?: {} }
    'machines.store': { paramsTuple?: []; params?: {} }
    'machines.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.retire': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.maintenance': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.expense': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.index': { paramsTuple?: []; params?: {} }
    'quotations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.store': { paramsTuple?: []; params?: {} }
    'quotations.send': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.convert': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.suggest_price': { paramsTuple?: []; params?: {} }
    'quotations.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sales.index': { paramsTuple?: []; params?: {} }
    'sales.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sales.store': { paramsTuple?: []; params?: {} }
    'sales.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sales.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.pay': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.void': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pos.index': { paramsTuple?: []; params?: {} }
    'pos.sell': { paramsTuple?: []; params?: {} }
    'reports.profit': { paramsTuple?: []; params?: {} }
    'reports.inventory': { paramsTuple?: []; params?: {} }
    'reports.jobs': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'health': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'system.roles': { paramsTuple?: []; params?: {} }
    'system.invitations': { paramsTuple?: []; params?: {} }
    'system.users': { paramsTuple?: []; params?: {} }
    'settings.modules': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'materials.index': { paramsTuple?: []; params?: {} }
    'components.index': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.download': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'fileId': ParamValue} }
    'products.qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.qr.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.index': { paramsTuple?: []; params?: {} }
    'inventory.index': { paramsTuple?: []; params?: {} }
    'purchases.index': { paramsTuple?: []; params?: {} }
    'purchases.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.index': { paramsTuple?: []; params?: {} }
    'jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.index': { paramsTuple?: []; params?: {} }
    'machines.new': { paramsTuple?: []; params?: {} }
    'machines.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.index': { paramsTuple?: []; params?: {} }
    'quotations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sales.index': { paramsTuple?: []; params?: {} }
    'sales.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pos.index': { paramsTuple?: []; params?: {} }
    'reports.profit': { paramsTuple?: []; params?: {} }
    'reports.inventory': { paramsTuple?: []; params?: {} }
    'reports.jobs': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'health': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'system.roles': { paramsTuple?: []; params?: {} }
    'system.invitations': { paramsTuple?: []; params?: {} }
    'system.users': { paramsTuple?: []; params?: {} }
    'settings.modules': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'customers.index': { paramsTuple?: []; params?: {} }
    'materials.index': { paramsTuple?: []; params?: {} }
    'components.index': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.download': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'fileId': ParamValue} }
    'products.qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.qr.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.index': { paramsTuple?: []; params?: {} }
    'inventory.index': { paramsTuple?: []; params?: {} }
    'purchases.index': { paramsTuple?: []; params?: {} }
    'purchases.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.index': { paramsTuple?: []; params?: {} }
    'jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.index': { paramsTuple?: []; params?: {} }
    'machines.new': { paramsTuple?: []; params?: {} }
    'machines.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.index': { paramsTuple?: []; params?: {} }
    'quotations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sales.index': { paramsTuple?: []; params?: {} }
    'sales.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pos.index': { paramsTuple?: []; params?: {} }
    'reports.profit': { paramsTuple?: []; params?: {} }
    'reports.inventory': { paramsTuple?: []; params?: {} }
    'reports.jobs': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'session.store': { paramsTuple?: []; params?: {} }
    'invitation.store': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'system.users.update_roles': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.store': { paramsTuple?: []; params?: {} }
    'invitations.resend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.revoke': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'settings.modules.update': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.destroy': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.store': { paramsTuple?: []; params?: {} }
    'customers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'customers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.store': { paramsTuple?: []; params?: {} }
    'materials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.image.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'materials.image.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.store': { paramsTuple?: []; params?: {} }
    'components.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.image.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'components.image.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.image.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.image.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.upload': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.files.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'fileId': ParamValue} }
    'products.defaultPrice.set': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.defaultPrice.clear': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.images.upload': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.images.setPrimary': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'imageId': ParamValue} }
    'products.images.reorder': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.store': { paramsTuple?: []; params?: {} }
    'product_categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.restore': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'inventory.adjust': { paramsTuple?: []; params?: {} }
    'purchases.store': { paramsTuple?: []; params?: {} }
    'purchases.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'purchases.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.store': { paramsTuple?: []; params?: {} }
    'jobs.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.pause': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.resume': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.skipStage': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.consume': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.expense': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.fail': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.store': { paramsTuple?: []; params?: {} }
    'machines.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.retire': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.maintenance': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'machines.expense': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.store': { paramsTuple?: []; params?: {} }
    'quotations.send': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.convert': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'quotations.suggest_price': { paramsTuple?: []; params?: {} }
    'sales.store': { paramsTuple?: []; params?: {} }
    'sales.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sales.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.pay': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.void': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pos.sell': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}