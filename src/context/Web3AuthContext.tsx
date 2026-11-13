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

import {
  getWeb3AuthClientId,
  WEB3AUTH_NETWORK_TARGET,
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

/**
 * True when Web3Auth/Auth threw a known frozen-JRPC / transient auth noise error.
 * @param error - Unknown thrown value.
 */
function isReadonlyAuthBridgeError(error: unknown): boolean {
  const message = toErrorMessage(error, "").toLowerCase();
  return (
    message.includes("read only property") ||
    message.includes("readonly property") ||
    message.includes("failed to login with auth") ||
    message.includes("failed to connect with wallet") ||
    message.includes("walletloginerror")
  );
}

const AUTH_CONSOLE_FILTER = "__yieldvaultAuthConsoleFilter";

/**
 * Keeps Next.js from turning Web3Auth console.error noise into red overlays.
 */
function installAuthConsoleFilter(): void {
  if (typeof window === "undefined") return;

  const current = window.console.error as typeof console.error & {
    [AUTH_CONSOLE_FILTER]?: boolean;
  };
  if (current[AUTH_CONSOLE_FILTER]) return;

  const wrapped = ((...args: unknown[]): void => {
    if (
      args.some(
        (arg) =>
          isStaleWeb3AuthSessionError(arg) || isReadonlyAuthBridgeError(arg),
      )
    ) {
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
 * Chains come from the Embedded Wallets dashboard. XRPL addresses are still
 * derived locally from `private_key` so existing Testnet wallets stay stable.
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

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      if (
        isIgnorableAuthBridgeError(event.reason) ||
        isReadonlyAuthBridgeError(event.reason)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleWindowError = (event: ErrorEvent): void => {
      if (
        isIgnorableAuthBridgeError(event.error ?? event.message) ||
        isReadonlyAuthBridgeError(event.error ?? event.message)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);
    window.addEventListener("error", handleWindowError, true);
    installAuthConsoleFilter();

    const init = async (): Promise<void> => {
      const bootInstance = (): Web3Auth => {
        const clientId = getWeb3AuthClientId();
        return new Web3Auth({
          clientId,
          web3AuthNetwork: WEB3AUTH_NETWORK_TARGET,
          // Dashboard-managed chains only. Avoid XrplPrivateKeyProvider here —
          // its JRPC middleware freezes request ids and breaks Google login.
          uiConfig: {
            uxMode: "popup",
          },
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
        if (
          isIgnorableAuthBridgeError(initError) ||
          isReadonlyAuthBridgeError(initError)
        ) {
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
      // Fresh mutable params — Auth connector freezes/mutates login payloads.
      const loginParams = {
        authConnection: AUTH_CONNECTION.GOOGLE,
      };

      const connection = await withoutInjectedEthereum(async () =>
        web3auth.connectTo(WALLET_CONNECTORS.AUTH, { ...loginParams }),
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

      // After a noisy auth bridge error, the session may still be usable.
      if (
        isInjectedWalletExtensionError(loginError) ||
        isBenignProviderRpcError(loginError) ||
        isReadonlyAuthBridgeError(loginError)
      ) {
        logAuthIssue(
          "login",
          `Recovering after auth bridge noise: ${toErrorMessage(loginError, "noise")}`,
        );
        const activeProvider = resolveActiveProvider(web3auth);
        if (activeProvider || web3auth.connected) {
          try {
            if (activeProvider) {
              await hydrateFromProvider(activeProvider, web3auth);
              return true;
            }
          } catch {
            // Fall through.
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
        !isUserCancellationError(logoutError) &&
        !isReadonlyAuthBridgeError(logoutError)
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
