import { BaseModel, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'

interface WithRolesConfig<RoleModel> {
  roleModel: () => RoleModel
  pivotTable: string
  pivotForeignKey?: string
  pivotRelatedForeignKey?: string
}

export function withRoles<RoleModel extends typeof BaseModel & { new (): any }>(
  config: WithRolesConfig<RoleModel>
) {
  return <Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) => {
    class WithRoles extends superclass {
      @manyToMany(config.roleModel, {
        pivotTable: config.pivotTable,
        pivotForeignKey: config.pivotForeignKey ?? 'user_id',
        pivotRelatedForeignKey: config.pivotRelatedForeignKey ?? 'role_id',
      })
      declare roles: ManyToMany<RoleModel>

      async assignRole(role: InstanceType<RoleModel> | string | number) {
        const id = typeof role === 'object' ? (role as any).id : role
        await (this as any).related('roles').attach([id])
      }

      async assignRoles(roles: Array<InstanceType<RoleModel> | string | number>) {
        const ids = roles.map((r) => (typeof r === 'object' ? (r as any).id : r))
        await (this as any).related('roles').attach(ids)
      }

      async syncRoles(roles: Array<InstanceType<RoleModel> | string | number>) {
        const ids = roles.map((r) => (typeof r === 'object' ? (r as any).id : r))
        await (this as any).related('roles').sync(ids)
      }

      async revokeRole(role: InstanceType<RoleModel> | string | number) {
        const id = typeof role === 'object' ? (role as any).id : role
        await (this as any).related('roles').detach([id])
      }

      async revokeRoles(roles: Array<InstanceType<RoleModel> | string | number>) {
        const ids = roles.map((r) => (typeof r === 'object' ? (r as any).id : r))
        await (this as any).related('roles').detach(ids)
      }

      async hasRole(name: string): Promise<boolean> {
        const roles = await this.getRoles()
        return roles.some((r: any) => r.name === name)
      }

      async getRoles(): Promise<Array<InstanceType<RoleModel>>> {
        const self = this as any
        if (self.$preloaded?.roles) return self.roles
        await self.load('roles')
        return self.roles
      }

      /** Aggregate all permission keys across this user's roles, deduplicated */
      async getPermissions(): Promise<string[]> {
        const roles = await this.getRoles()
        const all = new Set<string>()
        for (const role of roles as any[]) {
          for (const key of role.permissions ?? []) all.add(key)
        }
        return [...all]
      }
    }
    return WithRoles
  }
}
