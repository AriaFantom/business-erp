/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
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
}
