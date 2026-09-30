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
import { Web3AuthNoModal } from "@web3auth/no-modal";
import {
  CHAIN_NAMESPACES,
  WALLET_ADAPTERS,
  type IProvider,
  type UserInfo,
} from "@web3auth/base";
import { AuthAdapter, LOGIN_PROVIDER } from "@web3auth/auth-adapter";
import { CommonPrivateKeyProvider } from "@web3auth/base-provider";

import {
  getPrivateKeyTransportChainConfig,
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

/**
 * OpenLogin adapter key.
 * In Web3Auth v9+, OpenLogin was renamed to AUTH (`WALLET_ADAPTERS.AUTH`).
 */
const OPENLOGIN_ADAPTER =
  (
    WALLET_ADAPTERS as Record<
      string,
      (typeof WALLET_ADAPTERS)[keyof typeof WALLET_ADAPTERS]
    >
  ).OPENLOGIN ?? WALLET_ADAPTERS.AUTH;

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
  /** Triggers Google / Gmail OpenLogin (no modal) via Web3Auth.
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
 * Web3Auth no-modal provider for Sapphire Devnet + Google OpenLogin.
 * Uses CommonPrivateKeyProvider so login never hits Ethereum EIP-1559 RPC.
 */
export function Web3AuthProvider({ children }: Web3AuthProviderProps) {
  const [web3auth, setWeb3auth] = useState<Web3AuthNoModal | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [session, setSession] = useState<Web3AuthSession | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Hydrates app session state from an authenticated Web3Auth provider.
   * @param activeProvider - Connected Web3Auth provider instance.
   * @param instance - Initialized Web3Auth no-modal instance.
   */
  const hydrateFromProvider = useCallback(
    async (
      activeProvider: IProvider,
      instance: Web3AuthNoModal,
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
     * Suppresses matching window ErrorEvents from the auth bridge.
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
     * Initializes Web3Auth no-modal + Auth (OpenLogin) with key-only provider.
     */
    const init = async (): Promise<void> => {
      const bootInstance = (): {
        instance: Web3AuthNoModal;
        authAdapter: AuthAdapter;
      } => {
        const clientId = getWeb3AuthClientId();
        const chainConfig = getPrivateKeyTransportChainConfig();

        if (chainConfig.chainNamespace !== CHAIN_NAMESPACES.OTHER) {
          throw new Error(
            `Expected CHAIN_NAMESPACES.OTHER for key transport, got: ${chainConfig.chainNamespace}`,
          );
        }

        const privateKeyProvider = new CommonPrivateKeyProvider({
          config: {
            chainConfig,
            keyExportEnabled: true,
          },
        });

        const instance = new Web3AuthNoModal({
          clientId,
          web3AuthNetwork: WEB3AUTH_NETWORK_TARGET,
          privateKeyProvider,
        });

        const authAdapter = new AuthAdapter({
          adapterSettings: {
            clientId,
            network: WEB3AUTH_NETWORK_TARGET,
            uxMode: "popup",
          },
          privateKeyProvider,
        });

        return { instance, authAdapter };
      };

      const connectInstance = async (
        instance: Web3AuthNoModal,
        authAdapter: AuthAdapter,
      ): Promise<void> => {
        installAuthConsoleFilter();
        await withoutInjectedEthereum(async () => {
          instance.configureAdapter(authAdapter);
          await instance.init();
        });
      };

      try {
        let { instance, authAdapter } = bootInstance();

        try {
          await connectInstance(instance, authAdapter);
        } catch (firstError: unknown) {
          if (!isStaleWeb3AuthSessionError(firstError)) {
            throw firstError;
          }
          logAuthIssue(
            "stale session",
            "Clearing expired Web3Auth storage and retrying init.",
          );
          clearStaleWeb3AuthStorage();
          ({ instance, authAdapter } = bootInstance());
          await connectInstance(instance, authAdapter);
        }

        if (cancelled) return;

        setWeb3auth(instance);

        if (instance.connected && instance.provider) {
          await hydrateFromProvider(instance.provider, instance);
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
   * Google / Gmail sign-in via OpenLogin adapter — bypasses Web3Auth Modal.
   * Does not touch Ethereum RPC (CommonPrivateKeyProvider only exposes private_key).
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
      // Google OpenLogin only — never call MetaMask even if the extension is installed.
      const connectedProvider = await withoutInjectedEthereum(async () =>
        web3auth.connectTo(OPENLOGIN_ADAPTER, {
          loginProvider: LOGIN_PROVIDER.GOOGLE,
        }),
      );

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
        if (web3auth.provider) {
          try {
            await hydrateFromProvider(web3auth.provider, web3auth);
            return true;
          } catch {
            // Fall through.
          }
        }
        return false;
      }

      if (isBenignProviderRpcError(loginError) && web3auth.provider) {
        logAuthIssue(
          "connectTo",
          "Benign RPC noise; hydrating from active provider.",
        );
        try {
          await hydrateFromProvider(web3auth.provider, web3auth);
          return true;
        } catch {
          // Fall through to user-facing error.
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
