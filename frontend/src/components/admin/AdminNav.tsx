'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Truck, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_LINKS = [
  { href: '/admin/users',    label: 'Usuarios',  icon: Users },
  { href: '/admin/vehicles', label: 'Vehículos', icon: Truck },
  { href: '/admin/routes',   label: 'Rutas',     icon: Route },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-6 py-2">
      <span className="mr-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Admin
      </span>
      {ADMIN_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
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
      })}
    </div>
  );
}
