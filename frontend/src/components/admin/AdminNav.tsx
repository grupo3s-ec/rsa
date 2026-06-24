'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, ClipboardList, Database, Route, Settings, Truck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const ANALYSIS_LINKS = [
  { href: '/admin/reporteria', label: 'Reportería', icon: BarChart2 },
  { href: '/admin/auditoria',  label: 'Auditoría',  icon: ClipboardList },
] as const;

const CONFIG_LINKS = [
  { href: '/admin/users',    label: 'Usuarios',  icon: Users },
  { href: '/admin/vehicles', label: 'Vehículos', icon: Truck },
  { href: '/admin/routes',   label: 'Rutas',     icon: Route },
  { href: '/admin/geotab',   label: 'Geotab',    icon: Database },
  { href: '/admin/sistema',  label: 'Sistema',   icon: Settings },
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
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/60 px-6 py-2">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
        Admin
      </span>

      <div className="flex items-center gap-0.5">
        {ANALYSIS_LINKS.map((l) => <NavLink key={l.href} {...l} />)}
      </div>

      <div className="h-4 w-px bg-border/60" />

      <div className="flex items-center gap-0.5">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
          Config
        </span>
        {CONFIG_LINKS.map((l) => <NavLink key={l.href} {...l} />)}
      </div>
    </div>
  );
}
