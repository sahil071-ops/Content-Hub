'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Library,
  Upload,
  Tags,
  Users,
  HardDrive,
  ChevronRight,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  BarChart2,
  TrendingUp,
  History,
  Linkedin,
  PlusSquare,
  LayoutDashboard,
  Sparkles,
  ContactRound,
  Plug,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { UserRoleEnum } from '@/types/database';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRoleEnum[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'marketing'],
  },
];

const ANALYTICS_NAV_ITEMS: NavItem[] = [
  {
    label: 'Trends',
    href: '/analytics/trends',
    icon: TrendingUp,
    roles: ['admin', 'marketing'],
  },
  {
    label: 'Content Analytics',
    href: '/analytics/content',
    icon: BarChart2,
    roles: ['admin', 'marketing', 'sales'],
  },
  {
    label: 'Detailed MIS',
    href: '/analytics/mis',
    icon: History,
    roles: ['admin', 'marketing'],
  },
  {
    label: 'Pull History',
    href: '/analytics/mis/history',
    icon: BarChart2,
    roles: ['admin'],
  },
];

const CONTENT_NAV_ITEMS: NavItem[] = [
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

const LINKEDIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Post Library',
    href: '/linkedin',
    icon: Linkedin,
    roles: ['admin', 'marketing', 'sales'],
  },
  {
    label: 'Add Post',
    href: '/linkedin/add',
    icon: PlusSquare,
    roles: ['admin', 'marketing'],
  },
  {
    label: 'Dashboard',
    href: '/linkedin/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'marketing', 'sales'],
  },
  {
    label: 'AI Insights',
    href: '/linkedin/insights',
    icon: Sparkles,
    roles: ['admin', 'marketing', 'sales'],
  },
];

const LEADS_NAV_ITEMS: NavItem[] = [
  {
    label: 'Lead Library',
    href: '/leads',
    icon: ContactRound,
    roles: ['admin', 'marketing', 'sales'],
  },
  {
    label: 'AI Learnings',
    href: '/leads/learnings',
    icon: Brain,
    roles: ['admin', 'marketing', 'sales'],
  },
  {
    label: 'Zoho Setup',
    href: '/admin/zoho',
    icon: Plug,
    roles: ['admin'],
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Tag Management',
    href: '/admin/tags',
    icon: Tags,
    roles: ['admin', 'marketing'],
  },
  {
    label: 'Content Types',
    href: '/admin/content-types',
    icon: LayoutGrid,
    roles: ['admin', 'marketing'],
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
  {
    label: 'LinkedIn Accounts',
    href: '/admin/linkedin',
    icon: Linkedin,
    roles: ['admin'],
  },
];

interface AppSidebarProps {
  userRole: UserRoleEnum;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({ userRole, onNavigate, collapsed = false, onToggleCollapse }: AppSidebarProps) {
  const pathname = usePathname();

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const visibleAnalytics = ANALYTICS_NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const visibleContent = CONTENT_NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const visibleLinkedIn = LINKEDIN_NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const visibleLeads = LEADS_NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const visibleAdmin = ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const link = (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed ? 'justify-center' : 'gap-3',
          isActive
            ? 'bg-[#2323A3] text-white'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            {item.label}
            {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
          </>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col bg-[#1a1a2e] text-white">
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b border-white/10 shrink-0',
          collapsed ? 'justify-center px-2' : 'gap-2 px-6'
        )}>
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#2323A3] shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-bold text-sm leading-tight">Axis</div>
              <div className="text-xs text-white/50 leading-tight">Content Hub</div>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 px-2 py-4">
          {/* Main navigation */}
          <nav className="space-y-1">
            {visibleNav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Analytics section */}
          {visibleAnalytics.length > 0 && (
            <>
              <Separator className="my-4 bg-white/10" />
              {!collapsed && (
                <div className="px-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                    Analytics
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                {visibleAnalytics.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </nav>
            </>
          )}

          {/* LinkedIn section */}
          {visibleLinkedIn.length > 0 && (
            <>
              <Separator className="my-4 bg-white/10" />
              {!collapsed && (
                <div className="px-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                    LinkedIn
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                {visibleLinkedIn.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </nav>
            </>
          )}

          {/* Leads / CRM section */}
          {visibleLeads.length > 0 && (
            <>
              <Separator className="my-4 bg-white/10" />
              {!collapsed && (
                <div className="px-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                    CRM Leads
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                {visibleLeads.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </nav>
            </>
          )}

          {/* Content section */}
          {visibleContent.length > 0 && (
            <>
              <Separator className="my-4 bg-white/10" />
              {!collapsed && (
                <div className="px-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                    Content
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                {visibleContent.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </nav>
            </>
          )}

          {/* Admin section */}
          {visibleAdmin.length > 0 && (
            <>
              <Separator className="my-4 bg-white/10" />
              {!collapsed && (
                <div className="px-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                    Administration
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                {visibleAdmin.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </nav>
            </>
          )}
        </ScrollArea>

        {/* Desktop collapse toggle — only shown when onToggleCollapse is provided */}
        {onToggleCollapse && (
          <div className="shrink-0 border-t border-white/10 p-2">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleCollapse}
                    className="flex w-full items-center justify-center rounded-md px-3 py-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={onToggleCollapse}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors text-xs"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                Collapse
              </button>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
