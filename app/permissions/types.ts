export type ActionConfig =
  | true
  | string
  | { description?: string; inactive?: boolean; aliases?: string[] }

export type ResourceMap = Record<string, Record<string, ActionConfig>>

/** Derives the literal union 'product.create' | 'product.update' | ... from the map */
export type PermissionKeys<T extends ResourceMap> = {
  [R in keyof T]: {
    [A in keyof T[R]]: `${R & string}.${A & string}`
  }[keyof T[R]]
}[keyof T] &
  string

export interface PermissionDefinition {
  key: string
  description: string
  inactive: boolean
  aliases: string[]
}
