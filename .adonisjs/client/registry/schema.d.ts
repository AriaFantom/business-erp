/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'health': {
    methods: ["GET","HEAD"]
    pattern: '/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/root_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/root_controller').default['index']>>>
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
    }
  }
  'invitation.show': {
    methods: ["GET","HEAD"]
    pattern: '/invite/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/invitations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/invitations_controller').default['show']>>>
    }
  }
  'invitation.store': {
    methods: ["POST"]
    pattern: '/invite/:token'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invitation').acceptInvitationValidator)>>
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/invitation').acceptInvitationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/invitations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['index']>>>
    }
  }
  'system.roles': {
    methods: ["GET","HEAD"]
    pattern: '/system/roles'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['index']>>>
    }
  }
  'system.invitations': {
    methods: ["GET","HEAD"]
    pattern: '/system/invitations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['index']>>>
    }
  }
  'system.users': {
    methods: ["GET","HEAD"]
    pattern: '/system/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['index']>>>
    }
  }
  'system.users.update_roles': {
    methods: ["POST"]
    pattern: '/system/users/:id/roles'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/users').updateUserRolesValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/users').updateUserRolesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['updateRoles']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['updateRoles']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invitations.store': {
    methods: ["POST"]
    pattern: '/invitations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invitation').createInvitationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/invitation').createInvitationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invitations.resend': {
    methods: ["POST"]
    pattern: '/invitations/:id/resend'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['resend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['resend']>>>
    }
  }
  'invitations.revoke': {
    methods: ["POST"]
    pattern: '/invitations/:id/revoke'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['revoke']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitations_controller').default['revoke']>>>
    }
  }
  'roles.store': {
    methods: ["POST"]
    pattern: '/roles'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/role').createRoleValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/role').createRoleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'roles.destroy': {
    methods: ["POST"]
    pattern: '/roles/:id/delete'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['destroy']>>>
    }
  }
  'settings.modules': {
    methods: ["GET","HEAD"]
    pattern: '/system/modules'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/settings_controller').default['showModules']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/settings_controller').default['showModules']>>>
    }
  }
  'settings.modules.update': {
    methods: ["POST"]
    pattern: '/system/modules'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/settings').updateModulesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/settings').updateModulesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/settings_controller').default['updateModules']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/settings_controller').default['updateModules']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'profile.update': {
    methods: ["POST"]
    pattern: '/profile'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/profile').updateProfileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/profile').updateProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'profile.avatar.show': {
    methods: ["GET","HEAD"]
    pattern: '/profile/avatar'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['avatar']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['avatar']>>>
    }
  }
  'profile.avatar.update': {
    methods: ["POST"]
    pattern: '/profile/avatar'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/profile').updateAvatarValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/profile').updateAvatarValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['updateAvatar']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['updateAvatar']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'profile.avatar.destroy': {
    methods: ["POST"]
    pattern: '/profile/avatar/delete'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['destroyAvatar']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['destroyAvatar']>>>
    }
  }
  'users.avatar.show': {
    methods: ["GET","HEAD"]
    pattern: '/users/:id/avatar'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['avatar']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['avatar']>>>
    }
  }
  'suppliers.index': {
    methods: ["GET","HEAD"]
    pattern: '/suppliers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['index']>>>
    }
  }
  'suppliers.store': {
    methods: ["POST"]
    pattern: '/suppliers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').createSupplierValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').createSupplierValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'suppliers.update': {
    methods: ["POST"]
    pattern: '/suppliers/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').updateSupplierValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').updateSupplierValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'suppliers.archive': {
    methods: ["POST"]
    pattern: '/suppliers/:id/archive'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['archive']>>>
    }
  }
  'customers.index': {
    methods: ["GET","HEAD"]
    pattern: '/customers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['index']>>>
    }
  }
  'customers.store': {
    methods: ["POST"]
    pattern: '/customers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').createCustomerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').createCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customers.update': {
    methods: ["POST"]
    pattern: '/customers/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').updateCustomerValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').updateCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customers.archive': {
    methods: ["POST"]
    pattern: '/customers/:id/archive'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['archive']>>>
    }
  }
  'materials.index': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/materials'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['index']>>>
    }
  }
  'materials.store': {
    methods: ["POST"]
    pattern: '/catalog/materials'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').createMaterialValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').createMaterialValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'materials.update': {
    methods: ["POST"]
    pattern: '/catalog/materials/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').updateMaterialValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').updateMaterialValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'materials.archive': {
    methods: ["POST"]
    pattern: '/catalog/materials/:id/archive'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['archive']>>>
    }
  }
  'materials.restore': {
    methods: ["POST"]
    pattern: '/catalog/materials/:id/restore'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['restore']>>>
    }
  }
  'materials.image.update': {
    methods: ["POST"]
    pattern: '/catalog/materials/:id/image'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').uploadCatalogImageValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').uploadCatalogImageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['updateImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['updateImage']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'materials.image.destroy': {
    methods: ["POST"]
    pattern: '/catalog/materials/:id/image/delete'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['destroyImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['destroyImage']>>>
    }
  }
  'materials.image.show': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/materials/:id/image'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['image']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/materials_controller').default['image']>>>
    }
  }
  'components.index': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/components'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['index']>>>
    }
  }
  'components.store': {
    methods: ["POST"]
    pattern: '/catalog/components'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').createComponentValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').createComponentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'components.update': {
    methods: ["POST"]
    pattern: '/catalog/components/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').updateComponentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').updateComponentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'components.archive': {
    methods: ["POST"]
    pattern: '/catalog/components/:id/archive'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['archive']>>>
    }
  }
  'components.restore': {
    methods: ["POST"]
    pattern: '/catalog/components/:id/restore'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['restore']>>>
    }
  }
  'components.image.update': {
    methods: ["POST"]
    pattern: '/catalog/components/:id/image'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').uploadCatalogImageValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').uploadCatalogImageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['updateImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['updateImage']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'components.image.destroy': {
    methods: ["POST"]
    pattern: '/catalog/components/:id/image/delete'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['destroyImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['destroyImage']>>>
    }
  }
  'components.image.show': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/components/:id/image'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/components_controller').default['image']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/components_controller').default['image']>>>
    }
  }
  'products.index': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
    }
  }
  'products.store': {
    methods: ["POST"]
    pattern: '/catalog/products'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').createProductValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').createProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.show': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
    }
  }
  'products.update': {
    methods: ["POST"]
    pattern: '/catalog/products/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').updateProductValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').updateProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.archive': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/archive'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['archive']>>>
    }
  }
  'products.restore': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/restore'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['restore']>>>
    }
  }
  'products.image.update': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/image'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').uploadCatalogImageValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').uploadCatalogImageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['updateImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['updateImage']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.image.destroy': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/image/delete'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroyImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroyImage']>>>
    }
  }
  'products.image.show': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products/:id/image'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['image']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['image']>>>
    }
  }
  'products.gallery.show': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products/:id/gallery/:imageId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; imageId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['galleryImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['galleryImage']>>>
    }
  }
  'products.files.index': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products/:id/files'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['listFiles']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['listFiles']>>>
    }
  }
  'products.files.upload': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/files'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').uploadProductFileValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').uploadProductFileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['uploadFile']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['uploadFile']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.files.download': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products/:id/files/:fileId/download'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; fileId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['downloadFile']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['downloadFile']>>>
    }
  }
  'products.files.destroy': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/files/:fileId/delete'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; fileId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroyFile']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroyFile']>>>
    }
  }
  'products.qr': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products/:id/qr'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['qr']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['qr']>>>
    }
  }
  'products.qr.download': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/products/:id/qr/download'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['qrDownload']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['qrDownload']>>>
    }
  }
  'products.defaultPrice.set': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/default-price'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').setProductDefaultPriceValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').setProductDefaultPriceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['setDefaultPrice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['setDefaultPrice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.defaultPrice.clear': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/default-price/delete'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['clearDefaultPrice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['clearDefaultPrice']>>>
    }
  }
  'products.images.upload': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/images'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').uploadProductImagesValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').uploadProductImagesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['uploadImages']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['uploadImages']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.images.setPrimary': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/images/:imageId/primary'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; imageId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['setPrimaryImage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['setPrimaryImage']>>>
    }
  }
  'products.images.reorder': {
    methods: ["POST"]
    pattern: '/catalog/products/:id/images/reorder'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').reorderProductImagesValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').reorderProductImagesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['reorderImages']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['reorderImages']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'product_categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/catalog/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['index']>>>
    }
  }
  'product_categories.store': {
    methods: ["POST"]
    pattern: '/catalog/categories'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').createProductCategoryValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').createProductCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'product_categories.update': {
    methods: ["POST"]
    pattern: '/catalog/categories/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').updateProductCategoryValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').updateProductCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'product_categories.archive': {
    methods: ["POST"]
    pattern: '/catalog/categories/:id/archive'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['archive']>>>
    }
  }
  'product_categories.restore': {
    methods: ["POST"]
    pattern: '/catalog/categories/:id/restore'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['restore']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['restore']>>>
    }
  }
  'inventory.index': {
    methods: ["GET","HEAD"]
    pattern: '/inventory'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/inventory_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/inventory_controller').default['index']>>>
    }
  }
  'inventory.adjust': {
    methods: ["POST"]
    pattern: '/inventory/adjustments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').adjustInventoryValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').adjustInventoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/inventory_controller').default['adjust']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/inventory_controller').default['adjust']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stockTakes.index': {
    methods: ["GET","HEAD"]
    pattern: '/inventory/stock-takes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['index']>>>
    }
  }
  'stockTakes.store': {
    methods: ["POST"]
    pattern: '/inventory/stock-takes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock_takes').createStockTakeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock_takes').createStockTakeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stockTakes.show': {
    methods: ["GET","HEAD"]
    pattern: '/inventory/stock-takes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['show']>>>
    }
  }
  'stockTakes.saveCounts': {
    methods: ["POST"]
    pattern: '/inventory/stock-takes/:id/counts'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock_takes').saveStockTakeCountsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/stock_takes').saveStockTakeCountsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['saveCounts']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['saveCounts']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stockTakes.refresh': {
    methods: ["POST"]
    pattern: '/inventory/stock-takes/:id/refresh'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['refresh']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['refresh']>>>
    }
  }
  'stockTakes.complete': {
    methods: ["POST"]
    pattern: '/inventory/stock-takes/:id/complete'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['complete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['complete']>>>
    }
  }
  'stockTakes.cancel': {
    methods: ["POST"]
    pattern: '/inventory/stock-takes/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_takes_controller').default['cancel']>>>
    }
  }
  'purchases.index': {
    methods: ["GET","HEAD"]
    pattern: '/purchases'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['index']>>>
    }
  }
  'purchases.show': {
    methods: ["GET","HEAD"]
    pattern: '/purchases/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['show']>>>
    }
  }
  'purchases.store': {
    methods: ["POST"]
    pattern: '/purchases'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/purchases').createPurchaseValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/purchases').createPurchaseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'purchases.confirm': {
    methods: ["POST"]
    pattern: '/purchases/:id/confirm'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['confirm']>>>
    }
  }
  'purchases.cancel': {
    methods: ["POST"]
    pattern: '/purchases/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['cancel']>>>
    }
  }
  'purchases.returns.store': {
    methods: ["POST"]
    pattern: '/purchases/:id/returns'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/purchases').returnPurchaseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/purchases').returnPurchaseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['storeReturn']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['storeReturn']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'purchases.payments.store': {
    methods: ["POST"]
    pattern: '/purchases/:id/payments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/purchases').payPurchaseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/purchases').payPurchaseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['storePayment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/purchases_controller').default['storePayment']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.floor': {
    methods: ["GET","HEAD"]
    pattern: '/production/floor'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['floor']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['floor']>>>
    }
  }
  'jobs.index': {
    methods: ["GET","HEAD"]
    pattern: '/jobs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['index']>>>
    }
  }
  'jobs.show': {
    methods: ["GET","HEAD"]
    pattern: '/jobs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['show']>>>
    }
  }
  'jobs.store': {
    methods: ["POST"]
    pattern: '/jobs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/jobs').createJobValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/jobs').createJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.start': {
    methods: ["POST"]
    pattern: '/jobs/:id/start'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/jobs').startJobValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/jobs').startJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['start']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['start']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.pause': {
    methods: ["POST"]
    pattern: '/jobs/:id/pause'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['pause']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['pause']>>>
    }
  }
  'jobs.resume': {
    methods: ["POST"]
    pattern: '/jobs/:id/resume'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['resume']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['resume']>>>
    }
  }
  'jobs.skipStage': {
    methods: ["POST"]
    pattern: '/jobs/:id/skip-stage'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['skipStage']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['skipStage']>>>
    }
  }
  'jobs.consume': {
    methods: ["POST"]
    pattern: '/jobs/:id/consumptions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/jobs').consumeMaterialValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/jobs').consumeMaterialValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['consume']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['consume']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.expense': {
    methods: ["POST"]
    pattern: '/jobs/:id/expenses'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/jobs').addExpenseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/jobs').addExpenseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['addExpense']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['addExpense']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.confirm': {
    methods: ["POST"]
    pattern: '/jobs/:id/confirm'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/jobs').confirmJobValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/jobs').confirmJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['confirm']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.fail': {
    methods: ["POST"]
    pattern: '/jobs/:id/fail'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/jobs').failJobValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/jobs').failJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['fail']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['fail']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.cancel': {
    methods: ["POST"]
    pattern: '/jobs/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['cancel']>>>
    }
  }
  'machines.index': {
    methods: ["GET","HEAD"]
    pattern: '/machines'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['index']>>>
    }
  }
  'machines.new': {
    methods: ["GET","HEAD"]
    pattern: '/machines/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['create']>>>
    }
  }
  'machines.store': {
    methods: ["POST"]
    pattern: '/machines'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/machines').createMachineValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/machines').createMachineValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'machines.show': {
    methods: ["GET","HEAD"]
    pattern: '/machines/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['show']>>>
    }
  }
  'machines.update': {
    methods: ["POST"]
    pattern: '/machines/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/machines').updateMachineValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/machines').updateMachineValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'machines.retire': {
    methods: ["POST"]
    pattern: '/machines/:id/retire'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['retire']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['retire']>>>
    }
  }
  'machines.maintenance': {
    methods: ["POST"]
    pattern: '/machines/:id/maintenance'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['toggleMaintenance']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['toggleMaintenance']>>>
    }
  }
  'machines.expense': {
    methods: ["POST"]
    pattern: '/machines/:id/expense'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/machines').machineExpenseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/machines').machineExpenseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['addExpense']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/machines_controller').default['addExpense']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'workers.index': {
    methods: ["GET","HEAD"]
    pattern: '/workers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['index']>>>
    }
  }
  'workers.new': {
    methods: ["GET","HEAD"]
    pattern: '/workers/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['create']>>>
    }
  }
  'workers.store': {
    methods: ["POST"]
    pattern: '/workers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/workers').createWorkerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/workers').createWorkerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'workers.show': {
    methods: ["GET","HEAD"]
    pattern: '/workers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['show']>>>
    }
  }
  'workers.update': {
    methods: ["POST"]
    pattern: '/workers/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/workers').updateWorkerValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/workers').updateWorkerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'workers.retire': {
    methods: ["POST"]
    pattern: '/workers/:id/retire'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['retire']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['retire']>>>
    }
  }
  'workers.reactivate': {
    methods: ["POST"]
    pattern: '/workers/:id/reactivate'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['reactivate']>>>
    }
  }
  'workers.payments.store': {
    methods: ["POST"]
    pattern: '/workers/:id/payments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/workers').workerPaymentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/workers').workerPaymentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['storePayment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workers_controller').default['storePayment']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'quotations.index': {
    methods: ["GET","HEAD"]
    pattern: '/quotations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['index']>>>
    }
  }
  'quotations.new': {
    methods: ["GET","HEAD"]
    pattern: '/quotations/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['create']>>>
    }
  }
  'quotations.show': {
    methods: ["GET","HEAD"]
    pattern: '/quotations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['show']>>>
    }
  }
  'quotations.store': {
    methods: ["POST"]
    pattern: '/quotations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/quotations').createQuotationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/quotations').createQuotationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'quotations.send': {
    methods: ["POST"]
    pattern: '/quotations/:id/send'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['send']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['send']>>>
    }
  }
  'quotations.accept': {
    methods: ["POST"]
    pattern: '/quotations/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['accept']>>>
    }
  }
  'quotations.reject': {
    methods: ["POST"]
    pattern: '/quotations/:id/reject'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['reject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['reject']>>>
    }
  }
  'quotations.convert': {
    methods: ["POST"]
    pattern: '/quotations/:id/convert'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['convert']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['convert']>>>
    }
  }
  'quotations.suggest_price': {
    methods: ["POST"]
    pattern: '/quotations/suggest-price'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/quotations').suggestPriceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/quotations').suggestPriceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['suggestPrice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['suggestPrice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'quotations.download': {
    methods: ["GET","HEAD"]
    pattern: '/quotations/:id/download'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['download']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotations_controller').default['download']>>>
    }
  }
  'orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
    }
  }
  'orders.new': {
    methods: ["GET","HEAD"]
    pattern: '/orders/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['create']>>>
    }
  }
  'orders.show': {
    methods: ["GET","HEAD"]
    pattern: '/orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['show']>>>
    }
  }
  'orders.store': {
    methods: ["POST"]
    pattern: '/orders'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/orders').createOrderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/orders').createOrderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.confirm': {
    methods: ["POST"]
    pattern: '/orders/:id/confirm'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['confirm']>>>
    }
  }
  'orders.cancel': {
    methods: ["POST"]
    pattern: '/orders/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancel']>>>
    }
  }
  'orders.returns.store': {
    methods: ["POST"]
    pattern: '/orders/:id/returns'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/orders').returnOrderValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/orders').returnOrderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['storeReturn']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['storeReturn']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.index': {
    methods: ["GET","HEAD"]
    pattern: '/invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['index']>>>
    }
  }
  'invoices.show': {
    methods: ["GET","HEAD"]
    pattern: '/invoices/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['show']>>>
    }
  }
  'invoices.pay': {
    methods: ["POST"]
    pattern: '/invoices/:id/payments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/orders').recordPaymentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/orders').recordPaymentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['pay']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['pay']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.void': {
    methods: ["POST"]
    pattern: '/invoices/:id/void'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['void']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['void']>>>
    }
  }
  'invoices.download': {
    methods: ["GET","HEAD"]
    pattern: '/invoices/:id/download'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['download']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['download']>>>
    }
  }
  'pos.index': {
    methods: ["GET","HEAD"]
    pattern: '/pos'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['index']>>>
    }
  }
  'pos.sell': {
    methods: ["POST"]
    pattern: '/pos/sell'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/pos').posSellValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/pos').posSellValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['sell']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['sell']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'pos.session.open': {
    methods: ["POST"]
    pattern: '/pos/session/open'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/pos').openCashSessionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/pos').openCashSessionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['openSession']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['openSession']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'pos.session.close': {
    methods: ["POST"]
    pattern: '/pos/session/close'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/pos').closeCashSessionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/pos').closeCashSessionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['closeSession']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pos_controller').default['closeSession']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.profit': {
    methods: ["GET","HEAD"]
    pattern: '/reports/profit'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['profit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['profit']>>>
    }
  }
  'reports.inventory': {
    methods: ["GET","HEAD"]
    pattern: '/reports/inventory'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['inventory']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['inventory']>>>
    }
  }
  'reports.jobs': {
    methods: ["GET","HEAD"]
    pattern: '/reports/jobs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['jobs']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['jobs']>>>
    }
  }
}
