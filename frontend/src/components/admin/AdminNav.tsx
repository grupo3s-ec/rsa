'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, ClipboardList, Database, Route, Settings, Truck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/context';

const ANALYSIS_LINKS = [
  { href: '/admin/reporteria', label: 'Reportería', icon: BarChart2, adminOnly: true },
  { href: '/admin/auditoria',  label: 'Auditoría',  icon: ClipboardList, adminOnly: true },
] as const;

const CONFIG_LINKS = [
  { href: '/admin/users',    label: 'Usuarios',  icon: Users,    adminOnly: true },
  { href: '/admin/vehicles', label: 'Vehículos', icon: Truck,    adminOnly: true },
  { href: '/admin/routes',   label: 'Rutas',     icon: Route,    adminOnly: true },
  { href: '/admin/geotab',   label: 'Geotab',    icon: Database, adminOnly: false },
  { href: '/admin/sistema',  label: 'Sistema',   icon: Settings, adminOnly: true },
] as const;

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </Link>
  );
}

export function AdminNav() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const visibleAnalysisLinks = ANALYSIS_LINKS.filter((l) => !l.adminOnly || isAdmin);
  const visibleConfigLinks   = CONFIG_LINKS.filter((l) => !l.adminOnly || isAdmin);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/60 px-6 py-2">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
        Admin
      </span>

      {visibleAnalysisLinks.length > 0 && (
        <div className="flex items-center gap-0.5">
          {visibleAnalysisLinks.map((l) => <NavLink key={l.href} {...l} />)}
        </div>
      )}

      {visibleAnalysisLinks.length > 0 && visibleConfigLinks.length > 0 && (
        <div className="h-4 w-px bg-border/60" />
      )}

      {visibleConfigLinks.length > 0 && (
        <div className="flex items-center gap-0.5">
          <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
            Config
          </span>
          {visibleConfigLinks.map((l) => <NavLink key={l.href} {...l} />)}
        </div>
      )}
    </div>
  );
}
