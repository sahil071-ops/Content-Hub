'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Library,
  Upload,
  Tags,
  Users,
  HardDrive,
  LayoutGrid,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { UserRoleEnum } from '@/types/database';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRoleEnum[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Content Library',
    href: '/library',
    icon: Library,
    roles: ['admin', 'marketing', 'sales', 'distributor', 'viewer'],
  },
  {
    label: 'Upload Content',
    href: '/upload',
    icon: Upload,
    roles: ['admin', 'marketing'],
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Tag Management',
    href: '/admin/tags',
    icon: Tags,
    roles: ['admin'],
  },
  {
    label: 'User Management',
    href: '/admin/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    label: 'Backup Monitor',
    href: '/admin/backup-logs',
    icon: HardDrive,
    roles: ['admin'],
  },
];

interface AppSidebarProps {
  userRole: UserRoleEnum;
  onNavigate?: () => void;
}

export function AppSidebar({ userRole, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const visibleAdmin = ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  return (
    <div className="flex h-full flex-col bg-[#1a1a2e] text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-[#2323A3]">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-sm leading-tight">Axis</div>
          <div className="text-xs text-white/50 leading-tight">Content Hub</div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {/* Main navigation */}
        <nav className="space-y-1">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#2323A3] text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Admin section */}
        {visibleAdmin.length > 0 && (
          <>
            <Separator className="my-4 bg-white/10" />
            <div className="px-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                Administration
              </span>
            </div>
            <nav className="space-y-1">
              {visibleAdmin.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[#2323A3] text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
