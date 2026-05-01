/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'invitation.show': {
    methods: ["GET","HEAD"],
    pattern: '/invite/:token',
    tokens: [{"old":"/invite/:token","type":0,"val":"invite","end":""},{"old":"/invite/:token","type":1,"val":"token","end":""}],
    types: placeholder as Registry['invitation.show']['types'],
  },
  'invitation.store': {
    methods: ["POST"],
    pattern: '/invite/:token',
    tokens: [{"old":"/invite/:token","type":0,"val":"invite","end":""},{"old":"/invite/:token","type":1,"val":"token","end":""}],
    types: placeholder as Registry['invitation.store']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/dashboard',
    tokens: [{"old":"/dashboard","type":0,"val":"dashboard","end":""}],
    types: placeholder as Registry['dashboard']['types'],
  },
  'invitations.store': {
    methods: ["POST"],
    pattern: '/invitations',
    tokens: [{"old":"/invitations","type":0,"val":"invitations","end":""}],
    types: placeholder as Registry['invitations.store']['types'],
  },
  'invitations.resend': {
    methods: ["POST"],
    pattern: '/invitations/:id/resend',
    tokens: [{"old":"/invitations/:id/resend","type":0,"val":"invitations","end":""},{"old":"/invitations/:id/resend","type":1,"val":"id","end":""},{"old":"/invitations/:id/resend","type":0,"val":"resend","end":""}],
    types: placeholder as Registry['invitations.resend']['types'],
  },
  'invitations.revoke': {
    methods: ["POST"],
    pattern: '/invitations/:id/revoke',
    tokens: [{"old":"/invitations/:id/revoke","type":0,"val":"invitations","end":""},{"old":"/invitations/:id/revoke","type":1,"val":"id","end":""},{"old":"/invitations/:id/revoke","type":0,"val":"revoke","end":""}],
    types: placeholder as Registry['invitations.revoke']['types'],
  },
  'roles.store': {
    methods: ["POST"],
    pattern: '/roles',
    tokens: [{"old":"/roles","type":0,"val":"roles","end":""}],
    types: placeholder as Registry['roles.store']['types'],
  },
  'roles.destroy': {
    methods: ["POST"],
    pattern: '/roles/:id/delete',
    tokens: [{"old":"/roles/:id/delete","type":0,"val":"roles","end":""},{"old":"/roles/:id/delete","type":1,"val":"id","end":""},{"old":"/roles/:id/delete","type":0,"val":"delete","end":""}],
    types: placeholder as Registry['roles.destroy']['types'],
  },
  'profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/profile',
    tokens: [{"old":"/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.show']['types'],
  },
  'profile.update': {
    methods: ["POST"],
    pattern: '/profile',
    tokens: [{"old":"/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.update']['types'],
  },
  'profile.avatar.update': {
    methods: ["POST"],
    pattern: '/profile/avatar',
    tokens: [{"old":"/profile/avatar","type":0,"val":"profile","end":""},{"old":"/profile/avatar","type":0,"val":"avatar","end":""}],
    types: placeholder as Registry['profile.avatar.update']['types'],
  },
  'profile.avatar.destroy': {
    methods: ["POST"],
    pattern: '/profile/avatar/delete',
    tokens: [{"old":"/profile/avatar/delete","type":0,"val":"profile","end":""},{"old":"/profile/avatar/delete","type":0,"val":"avatar","end":""},{"old":"/profile/avatar/delete","type":0,"val":"delete","end":""}],
    types: placeholder as Registry['profile.avatar.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
