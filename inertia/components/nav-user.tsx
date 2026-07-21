import { Form } from '@adonisjs/inertia/react'
import { router, usePage } from '@inertiajs/react'
import { ChevronsUpDown, LogOut, Settings, UserRound } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { userInitials } from '@/lib/user'
import type { Data } from '@generated/data'

type SidebarUser = NonNullable<Data.SharedProps['user']>

export function NavUser() {
  const { user } = usePage<Data.SharedProps>().props as unknown as {
    user: SidebarUser | undefined
  }
  const { isMobile } = useSidebar()

  if (!user) return null

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
  const initials = userInitials(user.firstName, user.lastName, user.email)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={fullName} />}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={fullName} />}
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => router.visit('/profile')}>
                <UserRound />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.visit('/profile')}>
                <Settings />
                Account Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="p-0">
              <Form action="/logout" method="post" className="w-full">
                {() => (
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </button>
                )}
              </Form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
