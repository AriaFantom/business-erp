import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitation.store': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'invitations.store': { paramsTuple?: []; params?: {} }
    'invitations.resend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.revoke': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.destroy': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'session.store': { paramsTuple?: []; params?: {} }
    'invitation.store': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'invitations.store': { paramsTuple?: []; params?: {} }
    'invitations.resend': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.revoke': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.update': { paramsTuple?: []; params?: {} }
    'profile.avatar.destroy': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}