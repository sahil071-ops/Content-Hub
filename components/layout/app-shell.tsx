'use client';

import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TopNav } from '@/components/layout/top-nav';
import { Footer } from '@/components/layout/footer';
import { SystemHealthBanner } from '@/components/layout/system-health-banner';
import type { UserRow } from '@/types/database';
import type { HealthIssue } from '@/lib/health';

interface AppShellProps {
  user: UserRow;
  healthIssues: HealthIssue[];
  children: React.ReactNode;
}

export function AppShell({ user, healthIssues, children }: AppShellProps) {
  // Initialize collapsed from localStorage after mount to avoid SSR mismatch
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
    setMounted(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  const sidebarWidth = collapsed ? 'md:w-16' : 'md:w-64';
  const contentPadding = collapsed ? 'md:pl-16' : 'md:pl-64';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — fixed, hidden on mobile (mobile handled by TopNav sheet) */}
      <aside
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30 transition-all duration-200 ${mounted ? sidebarWidth : 'md:w-64'}`}
      >
        <AppSidebar
          userRole={user.role}
          collapsed={mounted ? collapsed : false}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* Main content area */}
      <div
        className={`flex flex-1 flex-col min-h-screen transition-all duration-200 ${mounted ? contentPadding : 'md:pl-64'}`}
      >
        <TopNav user={user} />

        {healthIssues.length > 0 && (
          <SystemHealthBanner issues={healthIssues} />
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}
