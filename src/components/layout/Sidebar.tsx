"use client";

import {
  BarChart3,
  BookOpen,
  History,
  Landmark,
  LayoutDashboard,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition, type MouseEvent, type ReactNode } from "react";

export interface AppNavItem {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
}

export const APP_NAV: readonly AppNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Yield vaults & escrow deposit",
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/governance",
    label: "DAO Governance",
    description: "Proposals & voting power",
    icon: <Landmark className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/profile",
    label: "Profile & Security",
    description: "Account & self-custody",
    icon: <UserRound className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/history",
    label: "Transaction History",
    description: "On-chain XRPL logs",
    icon: <History className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/analytics",
    label: "Yield Calculator",
    description: "APY estimates",
    icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/guide",
    label: "Platform Guide",
    description: "Interactive walkthrough",
    icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
  },
] as const;

interface SidebarProps {
  pathname: string;
  variant: "desktop" | "mobile";
}

/**
 * App sidebar links. Prefetch is forced on so route chunks load before the click.
 * Clicks run inside `useTransition` so the current screen stays up until the next route is ready.
 */
export function Sidebar({ pathname, variant }: SidebarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    for (const item of APP_NAV) {
      router.prefetch(item.href);
    }
  }, [router]);

  const handleNavigate = (href: string, event: MouseEvent<HTMLAnchorElement>): void => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <nav
      className={
        variant === "desktop"
          ? "flex-1 space-y-1 p-3"
          : "space-y-1 border-t border-slate-800/60 px-3 py-3 lg:hidden"
      }
      aria-label={variant === "desktop" ? "App navigation" : "Mobile app navigation"}
    >
      {isPending ? (
        <span
          className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 animate-pulse bg-vault-cyan"
          aria-hidden="true"
        />
      ) : null}
      {APP_NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const className =
          variant === "desktop"
            ? `flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                active
                  ? "border border-vault-teal/30 bg-vault-teal/10 text-white"
                  : "border border-transparent text-vault-muted hover:bg-white/5 hover:text-white"
              }`
            : `flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                active
                  ? "bg-vault-teal/10 text-white"
                  : "text-vault-muted hover:bg-white/5 hover:text-white"
              }`;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            onClick={(event) => handleNavigate(item.href, event)}
            className={className}
          >
            <span
              className={
                variant === "desktop"
                  ? `mt-0.5 ${active ? "text-vault-teal" : "text-vault-muted"}`
                  : active
                    ? "text-vault-teal"
                    : "text-vault-muted"
              }
            >
              {item.icon}
            </span>
            {variant === "desktop" ? (
              <span>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-[11px] text-vault-muted">
                  {item.description}
                </span>
              </span>
            ) : (
              item.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
