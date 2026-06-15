'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, Map, List, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '/mapa',      label: 'Mapa',      icon: Map  },
  { href: '/incidents', label: 'Incidentes', icon: List },
] as const;

export function Navbar() {
  const pathname          = usePathname();
  const { user, logout }  = useAuth();
  const router            = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
      {/* Brand */}
      <Link
        href="/mapa"
        className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-70"
      >
        <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Shield className="size-3.5" />
        </span>
        RSA
      </Link>

      <span className="h-4 w-px bg-border/60" />

      {/* Nav links */}
      <nav className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/mapa' && pathname.startsWith(href));
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
      </nav>

      {/* Usuario + logout — empujado a la derecha */}
      {user ? (
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[140px] truncate text-sm text-muted-foreground sm:block">
              {user.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={handleLogout}
            className="size-7 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </header>
  );
}
