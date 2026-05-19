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
  'printers.index': {
    methods: ["GET","HEAD"]
    pattern: '/printers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['index']>>>
    }
  }
  'printers.new': {
    methods: ["GET","HEAD"]
    pattern: '/printers/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['create']>>>
    }
  }
  'printers.store': {
    methods: ["POST"]
    pattern: '/printers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/printers').createPrinterValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/printers').createPrinterValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'printers.show': {
    methods: ["GET","HEAD"]
    pattern: '/printers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['show']>>>
    }
  }
  'printers.update': {
    methods: ["POST"]
    pattern: '/printers/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/printers').updatePrinterValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/printers').updatePrinterValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'printers.retire': {
    methods: ["POST"]
    pattern: '/printers/:id/retire'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['retire']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['retire']>>>
    }
  }
  'printers.maintenance': {
    methods: ["POST"]
    pattern: '/printers/:id/maintenance'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['toggleMaintenance']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['toggleMaintenance']>>>
    }
  }
  'printers.expense': {
    methods: ["POST"]
    pattern: '/printers/:id/expense'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/printers').printerExpenseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/printers').printerExpenseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['addExpense']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/printers_controller').default['addExpense']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'sales.index': {
    methods: ["GET","HEAD"]
    pattern: '/sales'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['index']>>>
    }
  }
  'sales.show': {
    methods: ["GET","HEAD"]
    pattern: '/sales/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['show']>>>
    }
  }
  'sales.store': {
    methods: ["POST"]
    pattern: '/sales'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/sales').createSaleValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/sales').createSaleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'sales.confirm': {
    methods: ["POST"]
    pattern: '/sales/:id/confirm'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['confirm']>>>
    }
  }
  'sales.cancel': {
    methods: ["POST"]
    pattern: '/sales/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sales_controller').default['cancel']>>>
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
      body: ExtractBody<InferInput<(typeof import('#validators/sales').recordPaymentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/sales').recordPaymentValidator)>>
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
