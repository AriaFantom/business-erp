import Role from '#models/role'
import Invitation from '#models/invitation'
import User from '#models/user'
import { DateTime } from 'luxon'
import { permissions } from '#start/permissions'
import { assignableRoleIds } from '#services/role_hierarchy'
import {
  assignedRoleIds,
  highestRolePosition,
  rankedRoles,
  assignableRankedRoleIds,
} from '#services/role_order'
import { editUserRoles, manageUserAccess } from '#abilities/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type RoleListItem = {
  id: number
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  rankPosition: number
  permissions: string[]
  assignable: boolean
  reorderable: boolean
}

export type PendingInvitationItem = {
  id: number
  email: string | null
  role: string
  type: 'setup' | 'invite'
  expiresAt: string | null
  deliveryStatus: 'unknown' | 'sent' | 'failed'
  expired: boolean
}

export type PermissionCatalogItem = {
  key: string
  description: string
}

export type RolesViewModel = {
  roles: RoleListItem[]
  permissionCatalog: PermissionCatalogItem[]
}

export type InvitationsViewModel = {
  roles: RoleListItem[]
  pendingInvitations: PendingInvitationItem[]
}

async function fetchRolesAndAssignable(user: User) {
  const [roles, assignable] = await Promise.all([rankedRoles(), assignableRoleIds(user)])
  const assignableSet = new Set(assignable)
  const ownIds = new Set(await assignedRoleIds(user))
  const highest = await highestRolePosition(user, roles)
  return roles.map<RoleListItem>((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    description: r.description,
    isSystem: r.isSystem,
    rankPosition: r.rankPosition,
    permissions: r.permissions ?? [],
    assignable: assignableSet.has(r.id),
    reorderable:
      r.name !== 'owner' &&
      (user.isOwner || (highest !== null && r.rankPosition > highest && !ownIds.has(r.id))),
  }))
}

export async function getRolesViewModel(user: User): Promise<RolesViewModel> {
  const myPermissions = user.isOwner
    ? new Set(permissions.active())
    : new Set(await user.getPermissions())

  const roleList = await fetchRolesAndAssignable(user)

  return {
    roles: roleList,
    permissionCatalog: permissions
      .all()
      .filter((p) => myPermissions.has(p.key))
      .map<PermissionCatalogItem>((p) => ({ key: p.key, description: p.description })),
  }
}

export async function getInvitationsViewModel(user: User): Promise<InvitationsViewModel> {
  const [roleList, pending] = await Promise.all([
    fetchRolesAndAssignable(user),
    Invitation.query().where('status', 'pending').preload('role').orderBy('created_at', 'desc'),
  ])

  return {
    roles: roleList,
    pendingInvitations: pending.map<PendingInvitationItem>((i) => ({
      id: i.id,
      email: i.email,
      role: i.role?.displayName ?? '—',
      type: i.type as 'setup' | 'invite',
      expiresAt: i.expiresAt.toISO(),
      deliveryStatus: i.deliveryStatus as 'unknown' | 'sent' | 'failed',
      expired: i.expiresAt.toMillis() <= DateTime.now().toMillis(),
    })),
  }
}

export type UserListRow = {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  isOwner: boolean
  isActive: boolean
  editable: boolean
  accessEditable: boolean
  roles: { id: number; name: string; displayName: string }[]
}

export type AssignableRoleOption = {
  id: number
  name: string
  displayName: string
}

export type UsersViewModel = {
  users: UserListRow[]
  assignableRoles: AssignableRoleOption[]
  currentUserId: number
}

/**
 * Build the User List view model.
 *
 * - Owners see every user.
 * - Non-owners see only users whose roles all sit below their highest rank,
 *   excluding themselves and the workspace owner.
 *
 * Even users that the actor cannot edit (themselves, workspace owner) are
 * surfaced so the actor has visibility into who exists; the UI hides edit
 * actions for those rows and the server enforces it on POST.
 */
export async function getUsersViewModel(actor: User): Promise<UsersViewModel> {
  const allRoles = await rankedRoles()
  const assignableIds = actor.isOwner ? null : new Set(await assignableRoleIds(actor))

  const users = await User.query().preload('roles').orderBy('created_at', 'desc')

  const visibleUsers = actor.isOwner
    ? users
    : users.filter((u) => {
        if (u.id === actor.id) return true
        if (u.isOwner) return false
        if (u.roles.length === 0) return false
        return u.roles.every((r) => assignableIds!.has(r.id))
      })

  const editable = await Promise.all(
    visibleUsers.map(async (u) => {
      const decision = await editUserRoles.execute(actor, u)
      return typeof decision === 'boolean' ? decision : decision.authorized
    })
  )
  const accessEditable = await Promise.all(
    visibleUsers.map(async (u) => {
      const decision = await manageUserAccess.execute(actor, u)
      return typeof decision === 'boolean' ? decision : decision.authorized
    })
  )

  return {
    users: visibleUsers.map<UserListRow>((u, index) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isOwner: u.isOwner,
      isActive: u.isActive,
      editable: editable[index],
      accessEditable: accessEditable[index],
      roles: u.roles
        .sort((a, b) => a.rankPosition - b.rankPosition)
        .map((r) => ({ id: r.id, name: r.name, displayName: r.displayName })),
    })),
    assignableRoles: allRoles
      .filter((r) => r.name !== 'owner' && (actor.isOwner || assignableIds!.has(r.id)))
      .map<AssignableRoleOption>((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
      })),
    currentUserId: actor.id,
  }
}

/**
 * Final defensive guard for role-edit POSTs. Throws if any roleId is outside
 * the actor's lower-ranked roles. Owner bypasses the rank check (still
 * verifies role existence). Owner role itself is never assignable here.
 */
export async function ensureRolesAssignable(
  actor: User,
  roleIds: number[],
  trx?: TransactionClientContract
): Promise<void> {
  const found = await Role.query({ client: trx }).whereIn('id', roleIds)
  if (found.length !== roleIds.length) {
    throw new Error('One or more roles do not exist.')
  }

  // Workspace-owner role cannot be assigned through this surface, even by owner.
  if (found.some((r) => r.name === 'owner')) {
    throw new Error('The owner role cannot be assigned.')
  }

  if (actor.isOwner) return

  const assignable = new Set(await assignableRankedRoleIds(actor, trx))
  const overstep = roleIds.filter((id) => !assignable.has(id))
  if (overstep.length > 0) {
    throw new Error('You can only assign roles below your own rank.')
  }
}
