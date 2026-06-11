"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Map, List } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/routes/demo", label: "Mapa", icon: Map },
  { href: "/incidents", label: "Incidentes", icon: List },
] as const;

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
      {/* Brand */}
      <Link
        href="/routes/demo"
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
          const active = pathname === href || (href !== "/routes/demo" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
