'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/components/layout/theme-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { createClient } from '@/lib/supabase/client';
import type { UserRow } from '@/types/database';
import { toast } from 'sonner';

interface TopNavProps {
  user: UserRow;
}

export function TopNav({ user }: TopNavProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Sign out failed', { description: error.message });
    } else {
      router.push('/login');
      router.refresh();
    }
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar userRole={user.role} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Page title area — empty, each page sets its own heading */}
      <div className="flex-1" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatar_url || ''} alt={user.full_name || 'User'} />
              <AvatarFallback className="bg-[#2323A3] text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.full_name || 'User'}</p>
              <p className="text-xs leading-none text-muted-foreground capitalize">{user.role}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-accent' : ''}>
            <Sun className="mr-2 h-4 w-4" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-accent' : ''}>
            <Moon className="mr-2 h-4 w-4" /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')} className={theme === 'system' ? 'bg-accent' : ''}>
            <Monitor className="mr-2 h-4 w-4" /> System
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
