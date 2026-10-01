"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Menu, Wallet, X } from "lucide-react";
import { useCallback, useState, type MouseEvent } from "react";

import { ChainIcon } from "@/components/ui/ChainIcon";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";

interface NavLink {
  href: "/dashboard" | "/governance" | "/analytics" | "/guide";
  label: string;
  /** When true, unauthenticated clicks trigger Google login then navigate. */
  requiresAuth: boolean;
}

const NAV_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "Vaults", requiresAuth: true },
  { href: "/governance", label: "Governance", requiresAuth: true },
  { href: "/analytics", label: "Analytics", requiresAuth: true },
  { href: "/guide", label: "Platform Guide", requiresAuth: false },
] as const;

/**
 * Primary marketing-site navigation — App Router routes only (no hash anchors).
 */
export function Header() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const {
    isInitializing,
    isLoggingIn,
    isConnected,
    session,
    loginWithGoogle,
    logout,
  } = useWeb3Auth();

  const handleMobileMenuToggle = useCallback((): void => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMobileNavClose = useCallback((): void => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleGoogleSignIn = useCallback(async (): Promise<void> => {
    handleMobileNavClose();
    const ok = await loginWithGoogle();
    if (ok) {
      router.push("/dashboard");
    }
  }, [handleMobileNavClose, loginWithGoogle, router]);

  const handleLogout = useCallback((): void => {
    void logout();
  }, [logout]);

  /**
   * Web3Auth provisions the non-custodial XRPL key via Google today.
   * After a successful connection, enter the vault console.
   */
  const handleConnectWallet = useCallback(async (): Promise<void> => {
    handleMobileNavClose();
    const ok = await loginWithGoogle();
    if (ok) {
      router.push("/dashboard");
    }
  }, [handleMobileNavClose, loginWithGoogle, router]);

  /**
   * Navigates to console routes. Logged-out users on auth-gated links
   * are prompted to Google sign-in, then sent to the target path.
   */
  const handleNavClick = useCallback(
    async (
      event: MouseEvent<HTMLAnchorElement>,
      link: NavLink,
    ): Promise<void> => {
      handleMobileNavClose();

      if (!link.requiresAuth || isConnected) {
        return;
      }

      event.preventDefault();
      const ok = await loginWithGoogle();
      if (ok) {
        router.push(link.href);
      }
    },
    [handleMobileNavClose, isConnected, loginWithGoogle, router],
  );

  const googleBusy = isInitializing || isLoggingIn;
  const brandHref = isConnected ? "/dashboard" : "/";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-vault-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={brandHref} prefetch className="group flex items-center gap-2.5">
          <ChainIcon className="h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-base font-semibold tracking-tight text-white">
            XRP YieldVault
          </span>
        </Link>

        <nav
          className="hidden items-center gap-8 lg:flex"
          aria-label="Primary navigation"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              onClick={(event) => {
                void handleNavClick(event, link);
              }}
              className="text-sm text-vault-muted transition-colors hover:text-vault-cyan"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isConnected && session ? (
            <>
              <Link
                href="/dashboard"
                prefetch
                className="rounded-full border border-vault-teal/30 bg-vault-teal/10 px-4 py-2 text-sm font-medium text-vault-teal transition-colors hover:bg-vault-teal/20"
              >
                Dashboard
              </Link>
              <div className="rounded-full border border-slate-800/60 bg-vault-surface/50 px-4 py-2 text-xs text-vault-muted">
                <span className="text-white">{session.email ?? "Connected"}</span>
                <span className="mx-2 text-slate-600">·</span>
                <span className="font-mono text-vault-teal">
                  {truncateXrplAddress(session.xrplAddress)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 items-center rounded-full border border-slate-800/60 px-5 text-sm text-vault-muted hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  void handleGoogleSignIn();
                }}
                disabled={googleBusy}
                className="inline-flex h-10 items-center gap-2.5 rounded-full bg-white px-5 text-sm font-medium text-gray-800 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {googleBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                Sign in with Google
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConnectWallet();
                }}
                disabled={googleBusy}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-wallet px-5 text-sm font-semibold text-vault-bg shadow-neon-sm transition-all hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Connect Wallet
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-vault-muted hover:text-white lg:hidden"
          aria-expanded={isMobileMenuOpen}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={handleMobileMenuToggle}
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {isMobileMenuOpen ? (
        <nav
          className="border-t border-slate-800/60 px-4 py-4 lg:hidden"
          aria-label="Mobile navigation"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch
                  className="block rounded-lg px-3 py-2.5 text-sm text-vault-muted hover:bg-white/5 hover:text-white"
                  onClick={(event) => {
                    void handleNavClick(event, link);
                  }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-3 flex flex-col gap-2 border-t border-slate-800/60 pt-3">
              {isConnected && session ? (
                <>
                  <p className="px-1 text-xs text-vault-muted">
                    {session.email}
                    <br />
                    <span className="font-mono text-vault-teal">
                      {truncateXrplAddress(session.xrplAddress)}
                    </span>
                  </p>
                  <Link
                    href="/dashboard"
                    prefetch
                    onClick={handleMobileNavClose}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-vault-teal/30 bg-vault-teal/10 text-sm font-medium text-vault-teal"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-800/60 text-sm text-vault-muted"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void handleGoogleSignIn();
                    }}
                    disabled={googleBusy}
                    className="inline-flex h-10 items-center justify-center gap-2.5 rounded-full bg-white text-sm font-medium text-gray-800 disabled:opacity-60"
                  >
                    {googleBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <GoogleIcon className="h-4 w-4" />
                    )}
                    Sign in with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleConnectWallet();
                    }}
                    disabled={googleBusy}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-wallet text-sm font-semibold text-vault-bg disabled:opacity-60"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Connect Wallet
                  </button>
                </>
              )}
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
