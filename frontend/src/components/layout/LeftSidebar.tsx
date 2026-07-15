'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Map, List, Settings2, LogOut, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { RsaIcon } from '@/components/ui/RsaIcon';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { getDashboardStats } from '@/lib/api/admin';
import type { UserRole } from '@/types/auth';

const NAV_LINKS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[] | null;
}> = [
  { href: '/mapa',      label: 'Mapa',       icon: Map,             roles: null },
  { href: '/incidents', label: 'Incidentes', icon: List,            roles: null },
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard, roles: ['admin', 'operator'] },
  { href: '/admin',     label: 'Admin',      icon: Settings2,       roles: ['admin', 'operator'] },
];

export function LeftSidebar() {
  const pathname         = usePathname();
  const { user, logout } = useAuth();
  const router           = useRouter();

  const [openCount, setOpenCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user || user.role === 'driver') return;

    let active = true;

    async function fetchCount() {
      try {
        const stats = await getDashboardStats();
        if (active) setOpenCount(stats.incidents.open);
      } catch {}
    }

    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const visibleLinks = NAV_LINKS.filter(
    ({ roles }) => !roles || (user && roles.includes(user.role)),
  );

  return (
    <aside className="relative z-30 flex w-14 shrink-0 flex-col h-full border-r border-border/60 bg-background/80 backdrop-blur items-center py-3 gap-1">
      {/* Logo */}
      <div className="pb-2 border-b border-border/40 w-full flex justify-center mb-1">
        <Link
          href="/mapa"
          aria-label="Inicio"
          className="flex items-center justify-center rounded-lg p-1 text-foreground transition-opacity hover:opacity-70"
        >
          <RsaIcon size={20} />
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex flex-col gap-1 flex-1 items-center pt-2">
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const active    = pathname === href || (href !== '/mapa' && pathname.startsWith(href));
          const showBadge = href === '/incidents' && openCount !== null && openCount > 0;

          return (
            <div key={href} className="group relative">
              <Link
                href={href}
                aria-label={label}
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-full transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4" />
                {showBadge && (
                  <span className="absolute -right-1 -top-1 flex min-w-[14px] items-center justify-center rounded-full bg-red-500 px-[3px] py-px text-[9px] font-bold leading-none text-white">
                    {openCount > 99 ? '99+' : openCount}
                  </span>
                )}
              </Link>
              {/* Tooltip */}
              <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-lg border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md opacity-0 whitespace-nowrap transition-opacity group-hover:opacity-100">
                {label}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Usuario / configuración */}
      <div className="flex flex-col gap-1 items-center pt-2 border-t border-border/40 w-full">
        <ThemeToggle />

        {user && (
          <>
            {/* Indicador online */}
            <span className="relative flex size-1.5 my-0.5" title="Sistema en línea">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>

            {/* Avatar */}
            <span
              className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </span>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={handleLogout}
              className="size-7 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
