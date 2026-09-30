"use client";

import { useEffect, type ReactNode } from "react";

import { DevUserSwitcher } from "@/components/dev/DevUserSwitcher";
import { Web3AuthProvider } from "@/context/Web3AuthContext";
import { isIgnorableAuthBridgeError } from "@/lib/web3auth/xrpl";

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Installs capture-phase listeners so MetaMask / injected-wallet noise
 * never reaches the Next.js red runtime overlay. This app is XRPL + Google
 * OpenLogin only — it never calls MetaMask.
 */
function useSuppressInjectedWalletNoise(): void {
  useEffect(() => {
    const handleUnhandledRejection = (
      event: PromiseRejectionEvent,
    ): void => {
      if (!isIgnorableAuthBridgeError(event.reason)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn(
        "[AuthBridge] Suppressed injected-wallet / MetaMask noise:",
        event.reason instanceof Error ? event.reason.message : event.reason,
      );
    };

    const handleWindowError = (event: ErrorEvent): void => {
      if (!isIgnorableAuthBridgeError(event.error ?? event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn(
        "[AuthBridge] Suppressed injected-wallet / MetaMask error:",
        event.message,
      );
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);
    window.addEventListener("error", handleWindowError, true);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
        true,
      );
      window.removeEventListener("error", handleWindowError, true);
    };
  }, []);
}

/**
 * Client-side provider tree for App Router.
 * Keeps Web3Auth (browser-only SDK) out of the server layout body.
 */
export function AppProviders({ children }: AppProvidersProps) {
  useSuppressInjectedWalletNoise();
  return (
    <Web3AuthProvider>
      {children}
      <DevUserSwitcher />
    </Web3AuthProvider>
  );
}
