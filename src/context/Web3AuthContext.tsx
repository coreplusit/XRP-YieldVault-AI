"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_CONNECTION,
  WALLET_CONNECTORS,
  Web3Auth,
  type IProvider,
  type UserInfo,
} from "@web3auth/modal";
import { XrplPrivateKeyProvider } from "@web3auth/modal/providers/xrpl-provider";

import {
  getWeb3AuthClientId,
  getXrplTestnetChainConfig,
  WEB3AUTH_NETWORK_TARGET,
  XRPL_TESTNET_CHAIN_ID,
} from "@/lib/web3auth/config";
import { withoutInjectedEthereum } from "@/lib/web3auth/ethereumGuard";
import {
  deriveXrplAddressFromProvider,
  isBenignProviderRpcError,
  clearStaleWeb3AuthStorage,
  isIgnorableAuthBridgeError,
  isInjectedWalletExtensionError,
  isStaleWeb3AuthSessionError,
  isUserCancellationError,
} from "@/lib/web3auth/xrpl";
import { establishYieldVaultSession } from "@/lib/auth/sessionClient";
import { applyYieldVaultSession } from "@/lib/supabase/client";
import type { YieldVaultUser } from "@/lib/supabase/users";

/** Authenticated Web3Auth session exposed to the UI. */
export interface Web3AuthSession {
  email: string | null;
  name: string | null;
  xrplAddress: string;
  profileImage: string | null;
  dbUser: YieldVaultUser | null;
}

interface Web3AuthContextValue {
  isInitializing: boolean;
  isLoggingIn: boolean;
  isConnected: boolean;
  error: string | null;
  session: Web3AuthSession | null;
  /** Active Web3Auth provider used for XRPL key export / signing. */
  provider: IProvider | null;
  /** Triggers Google login via Web3Auth Auth connector (no modal UI).
   *  @returns true when a session was successfully hydrated. */
  loginWithGoogle: () => Promise<boolean>;
  /**
   * Re-attempts Supabase `users` sync for the current Web3Auth session.
   * @returns Synced user row, or null when offline / not connected / sync fails.
   */
  ensureDbUser: () => Promise<YieldVaultUser | null>;
  /** Clears the Web3Auth session and local auth state. */
  logout: () => Promise<void>;
}

const Web3AuthContext = createContext<Web3AuthContextValue | null>(null);

interface Web3AuthProviderProps {
  children: ReactNode;
}

/**
 * Builds a typed session object from Web3Auth user info + XRPL address.
 * @param userInfo - Partial profile from Web3Auth getUserInfo().
 * @param xrplAddress - Deterministic XRPL classic address.
 * @param dbUser - Synced Supabase user row when available.
 */
function buildSession(
  userInfo: Partial<UserInfo>,
  xrplAddress: string,
  dbUser: YieldVaultUser | null,
): Web3AuthSession {
  return {
    email: userInfo.email ?? null,
    name: userInfo.name ?? null,
    xrplAddress,
    profileImage: userInfo.profileImage ?? null,
    dbUser,
  };
}

/**
 * Normalizes unknown thrown values into a stable error message string.
 * @param error - Unknown thrown value.
 * @param fallback - Fallback message when parsing fails.
 */
function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return fallback;
}

/**
 * Logs a caught auth error without using `console.error`.
 * Next.js 15 maps console.error → red runtime overlays in development.
 * @param scope - Log scope label.
 * @param message - Human-readable message.
 */
function logAuthIssue(scope: string, message: string): void {
  console.warn(`[Web3Auth] ${scope}:`, message);
}

const AUTH_CONSOLE_FILTER = "__yieldvaultAuthConsoleFilter";

/**
 * Keeps Next.js from turning Web3Auth's expired-session console.error
 * into a red dev overlay. Must stay installed — restoring console.error
 * during Strict Mode cleanup lets the overlay through mid-init.
 */
function installAuthConsoleFilter(): void {
  if (typeof window === "undefined") return;

  const current = window.console.error as typeof console.error & {
    [AUTH_CONSOLE_FILTER]?: boolean;
  };
  if (current[AUTH_CONSOLE_FILTER]) return;

  const wrapped = ((...args: unknown[]): void => {
    if (args.some((arg) => isStaleWeb3AuthSessionError(arg))) {
      return;
    }
    current.apply(window.console, args);
  }) as typeof console.error & { [AUTH_CONSOLE_FILTER]?: boolean };

  wrapped[AUTH_CONSOLE_FILTER] = true;
  window.console.error = wrapped;
}

if (typeof window !== "undefined") {
  installAuthConsoleFilter();
}

/**
 * Resolves the active provider after a v11 Connection / connector login.
 * Prefer ethereumProvider (routes to XrplPrivateKeyProvider), then AUTH connector.
 * @param instance - Initialized Web3Auth instance.
 */
function resolveActiveProvider(instance: Web3Auth): IProvider | null {
  return (
    instance.connection?.ethereumProvider ??
    instance.getConnector(WALLET_CONNECTORS.AUTH)?.provider ??
    null
  );
}

/**
 * Web3Auth v11 Auth connector on Sapphire Devnet + Google login.
 * XRPL keys still come from private_key so existing Testnet addresses stay stable.
 */
export function Web3AuthProvider({ children }: Web3AuthProviderProps) {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [session, setSession] = useState<Web3AuthSession | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Hydrates app session state from an authenticated Web3Auth provider.
   * @param activeProvider - Connected Web3Auth provider instance.
   * @param instance - Initialized Web3Auth instance.
   */
  const hydrateFromProvider = useCallback(
    async (
      activeProvider: IProvider,
      instance: Web3Auth,
    ): Promise<void> => {
      let userInfo: Partial<UserInfo> = {};
      try {
        userInfo = await instance.getUserInfo();
      } catch (userInfoError: unknown) {
        if (!isBenignProviderRpcError(userInfoError)) {
          throw userInfoError;
        }
        logAuthIssue(
          "getUserInfo",
          "Benign RPC mismatch; continuing with empty profile.",
        );
      }

      const xrplAddress = await deriveXrplAddressFromProvider(activeProvider);

      let dbUser: YieldVaultUser | null = null;
      try {
        dbUser = await establishYieldVaultSession(
          activeProvider,
          userInfo.email ?? null,
        );
      } catch (syncError: unknown) {
        const message = toErrorMessage(syncError, "Supabase sync failed");
        logAuthIssue("User sync warning", message);
        setError(message);
      }

      setProvider(activeProvider);
      setSession(buildSession(userInfo, xrplAddress, dbUser));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    /**
     * Suppresses non-critical provider RPC / cancellation noise as overlays.
     * @param event - Browser unhandledrejection event.
     */
    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      if (isIgnorableAuthBridgeError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    /**
     * Suppresses injected-wallet / MetaMask window errors during Google login.
     * @param event - Browser error event.
     */
    const handleWindowError = (event: ErrorEvent): void => {
      if (isIgnorableAuthBridgeError(event.error ?? event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);
    window.addEventListener("error", handleWindowError, true);
    installAuthConsoleFilter();

    /**
     * Initializes Web3Auth modal SDK with XRPL private-key provider.
     */
    const init = async (): Promise<void> => {
      const bootInstance = (): Web3Auth => {
        const clientId = getWeb3AuthClientId();
        const chain = getXrplTestnetChainConfig();
        const privateKeyProvider = new XrplPrivateKeyProvider({
          config: {
            chain,
            chains: [chain],
            keyExportEnabled: true,
          },
        });

        return new Web3Auth({
          clientId,
          web3AuthNetwork: WEB3AUTH_NETWORK_TARGET,
          privateKeyProvider,
          chains: [chain],
          defaultChainId: XRPL_TESTNET_CHAIN_ID,
        });
      };

      const connectInstance = async (instance: Web3Auth): Promise<void> => {
        installAuthConsoleFilter();
        await withoutInjectedEthereum(async () => {
          await instance.init();
        });
      };

      try {
        let instance = bootInstance();

        try {
          await connectInstance(instance);
        } catch (firstError: unknown) {
          if (!isStaleWeb3AuthSessionError(firstError)) {
            throw firstError;
          }
          logAuthIssue(
            "stale session",
            "Clearing expired Web3Auth storage and retrying init.",
          );
          clearStaleWeb3AuthStorage();
          instance = bootInstance();
          await connectInstance(instance);
        }

        if (cancelled) return;

        setWeb3auth(instance);

        if (instance.connected) {
          const activeProvider = resolveActiveProvider(instance);
          if (activeProvider) {
            await hydrateFromProvider(activeProvider, instance);
          }
        }
      } catch (initError: unknown) {
        if (isIgnorableAuthBridgeError(initError)) {
          clearStaleWeb3AuthStorage();
          logAuthIssue(
            "Init noise suppressed",
            toErrorMessage(initError, "init warning"),
          );
        } else {
          const message = toErrorMessage(
            initError,
            "Failed to initialize Web3Auth",
          );
          logAuthIssue("init error", message);
          if (!cancelled) {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
        true,
      );
      window.removeEventListener("error", handleWindowError, true);
    };
  }, [hydrateFromProvider]);

  /**
   * Google sign-in via Auth connector — bypasses the Web3Auth modal UI.
   * @returns true when the session was hydrated successfully (caller may redirect).
   */
  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    if (!web3auth) {
      setError("Web3Auth is still initializing. Please wait a moment.");
      return false;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const connection = await withoutInjectedEthereum(async () =>
        web3auth.connectTo(WALLET_CONNECTORS.AUTH, {
          authConnection: AUTH_CONNECTION.GOOGLE,
        }),
      );

      const connectedProvider =
        connection?.ethereumProvider ?? resolveActiveProvider(web3auth);

      if (!connectedProvider) {
        console.info("[Web3Auth] Google login cancelled (no provider).");
        return false;
      }

      await hydrateFromProvider(connectedProvider, web3auth);
      return true;
    } catch (loginError: unknown) {
      if (isUserCancellationError(loginError)) {
        console.info("[Web3Auth] Google login cancelled by user.");
        return false;
      }

      if (isInjectedWalletExtensionError(loginError)) {
        logAuthIssue(
          "login",
          "Ignored MetaMask/injected-wallet noise during Google login.",
        );
        const activeProvider = resolveActiveProvider(web3auth);
        if (activeProvider) {
          try {
            await hydrateFromProvider(activeProvider, web3auth);
            return true;
          } catch {
            // Fall through.
          }
        }
        return false;
      }

      if (isBenignProviderRpcError(loginError)) {
        logAuthIssue(
          "connectTo",
          "Benign RPC noise; hydrating from active provider.",
        );
        const activeProvider = resolveActiveProvider(web3auth);
        if (activeProvider) {
          try {
            await hydrateFromProvider(activeProvider, web3auth);
            return true;
          } catch {
            // Fall through to user-facing error.
          }
        }
      }

      const message = toErrorMessage(loginError, "Google login failed");
      logAuthIssue("login error", message);
      setError(message);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, [hydrateFromProvider, web3auth]);

  /**
   * Re-syncs the logged-in Web3Auth identity into public.users and patches session.
   * Used by History / Dashboard when dbUser was null after a transient RLS/network miss.
   */
  const ensureDbUser = useCallback(async (): Promise<YieldVaultUser | null> => {
    if (!session?.xrplAddress || !provider) {
      return null;
    }
    if (session.dbUser) {
      return session.dbUser;
    }

    try {
      const dbUser = await establishYieldVaultSession(provider, session.email);
      setSession((current) =>
        current
          ? {
              ...current,
              dbUser,
            }
          : current,
      );
      setError(null);
      return dbUser;
    } catch (syncError: unknown) {
      const message = toErrorMessage(syncError, "Supabase sync failed");
      logAuthIssue("ensureDbUser", message);
      setError(message);
      return null;
    }
  }, [provider, session]);

  /**
   * Logs out of Web3Auth and clears local session state.
   */
  const logout = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      if (web3auth?.connected) {
        await web3auth.logout();
      }
    } catch (logoutError: unknown) {
      if (
        !isBenignProviderRpcError(logoutError) &&
        !isUserCancellationError(logoutError)
      ) {
        const message = toErrorMessage(logoutError, "Logout failed");
        logAuthIssue("logout error", message);
        setError(message);
      }
    } finally {
      applyYieldVaultSession(null);
      setProvider(null);
      setSession(null);
    }
  }, [web3auth]);

  const value = useMemo<Web3AuthContextValue>(
    () => ({
      isInitializing,
      isLoggingIn,
      isConnected: Boolean(provider && session),
      error,
      session,
      provider,
      loginWithGoogle,
      ensureDbUser,
      logout,
    }),
    [
      ensureDbUser,
      error,
      isInitializing,
      isLoggingIn,
      loginWithGoogle,
      logout,
      provider,
      session,
    ],
  );

  return (
    <Web3AuthContext.Provider value={value}>{children}</Web3AuthContext.Provider>
  );
}

/**
 * Accesses the Web3Auth context. Must be used under `Web3AuthProvider`.
 */
export function useWeb3Auth(): Web3AuthContextValue {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error("useWeb3Auth must be used within a Web3AuthProvider");
  }
  return context;
}
