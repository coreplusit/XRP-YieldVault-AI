"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  History,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChainIcon } from "@/components/ui/ChainIcon";
import { PitchModeWidget } from "@/components/ui/PitchModeWidget";
import { VaultDataProvider } from "@/context/VaultDataContext";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import { appConfig } from "@/lib/config/env";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";

interface AppNavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const APP_NAV: readonly AppNavItem[] = [
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
] as const;

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Authenticated SaaS app shell — sidebar navigation + top header.
 * Soft-guards unauthenticated users back to the marketing home.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isInitializing, isConnected, session, logout } = useWeb3Auth();
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isInitializing && !isConnected) {
      router.replace("/");
    }
  }, [isConnected, isInitializing, router]);

  useEffect(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  /** Logs out and returns to marketing home. */
  const handleLogout = useCallback((): void => {
    void logout().then(() => {
      router.replace("/");
    });
  }, [logout, router]);

  const initials = useMemo(() => {
    const source = session?.name ?? session?.email ?? "U";
    return source.slice(0, 1).toUpperCase();
  }, [session?.email, session?.name]);

  if (isInitializing || !isConnected || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-4 text-sm text-vault-muted">
          <Loader2
            className="h-4 w-4 animate-spin text-vault-cyan"
            aria-hidden="true"
          />
          {isInitializing ? "Restoring session…" : "Redirecting to sign in…"}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-800/60 bg-vault-bg/80 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800/60 px-5">
          <Link href="/dashboard" prefetch className="group flex items-center gap-2.5">
            <ChainIcon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
            <div>
              <p className="text-sm font-semibold text-white">XRP YieldVault</p>
              <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                App Console
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="App navigation">
          {APP_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                  active
                    ? "border border-vault-teal/30 bg-vault-teal/10 text-white"
                    : "border border-transparent text-vault-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`mt-0.5 ${active ? "text-vault-teal" : "text-vault-muted"}`}
                >
                  {item.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-vault-muted">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800/60 p-4">
          <div className="rounded-xl border border-slate-800/60 bg-vault-surface/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-vault-muted">
              Network
            </p>
            <p className="mt-1 font-mono text-xs text-vault-teal">
              XRPL {appConfig.xrpl.network}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-vault-bg/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex rounded-lg p-2 text-vault-muted hover:text-white lg:hidden"
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                {mobileNavOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <div className="lg:hidden">
                <p className="text-sm font-semibold text-white">XRP YieldVault</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-white">
                  {APP_NAV.find((item) => pathname.startsWith(item.href))?.label ??
                    "Console"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-vault-teal/30 bg-vault-teal/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-vault-teal">
                <span className="h-1.5 w-1.5 rounded-full bg-vault-teal" />
                {appConfig.xrpl.network}
              </span>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-800/60 bg-vault-surface/50 py-1 pl-1 pr-3 text-left transition-colors hover:border-vault-cyan/30"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-neon text-xs font-bold text-vault-bg">
                    {initials}
                  </span>
                  <span className="hidden max-w-[140px] truncate text-xs text-vault-muted sm:block">
                    {session.email ?? "Connected"}
                  </span>
                </button>

                {userMenuOpen ? (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800/60 bg-vault-bg/95 p-2 shadow-glass backdrop-blur-xl"
                    role="menu"
                  >
                    <div className="border-b border-slate-800/60 px-3 py-2">
                      <p className="truncate text-sm text-white">
                        {session.email ?? session.name ?? "User"}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-vault-muted">
                        {truncateXrplAddress(session.xrplAddress)}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-vault-muted hover:bg-white/5 hover:text-white"
                      role="menuitem"
                    >
                      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                      Profile & Security
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
                      role="menuitem"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Mobile nav drawer */}
          {mobileNavOpen ? (
            <nav
              className="space-y-1 border-t border-slate-800/60 px-3 py-3 lg:hidden"
              aria-label="Mobile app navigation"
            >
              {APP_NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                      active
                        ? "bg-vault-teal/10 text-white"
                        : "text-vault-muted hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </header>

        <main className="relative flex-1">
          <VaultDataProvider>{children}</VaultDataProvider>
        </main>
      </div>

      <PitchModeWidget />
    </div>
  );
}
