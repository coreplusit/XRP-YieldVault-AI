/**
 * MetaMask / injected-EVM guards for an XRPL + Web3Auth (Google) app.
 * This product never uses MetaMask — extension noise must not reach the UI.
 */

type EthereumLike = {
  request?: (args: { method?: string; params?: unknown }) => Promise<unknown>;
  connect?: (...args: unknown[]) => Promise<unknown>;
  enable?: (...args: unknown[]) => Promise<unknown>;
  send?: (...args: unknown[]) => unknown;
  sendAsync?: (...args: unknown[]) => unknown;
};

type WindowWithEthereum = Window & {
  ethereum?: EthereumLike;
};

/**
 * True when a method would talk to an injected EVM wallet.
 * @param method - JSON-RPC / provider method name.
 */
function isInjectedEvmMethod(method: string): boolean {
  const normalized = method.toLowerCase();
  return (
    normalized.startsWith("eth_") ||
    normalized.startsWith("wallet_") ||
    normalized.startsWith("personal_") ||
    normalized === "net_version" ||
    normalized === "web3_clientversion"
  );
}

/**
 * Returns a safe stub response for blocked EVM methods (never calls MetaMask).
 * @param method - JSON-RPC method name.
 */
function stubEvmResponse(method: string): unknown {
  const normalized = method.toLowerCase();
  if (
    normalized === "eth_accounts" ||
    normalized === "eth_requestaccounts" ||
    normalized === "wallet_requestpermissions"
  ) {
    return [];
  }
  if (normalized === "eth_chainid" || normalized === "net_version") {
    return "0x539";
  }
  if (normalized === "eth_call" || normalized === "eth_getbalance") {
    return "0x0";
  }
  return null;
}

/**
 * Temporarily stubs injected `window.ethereum` so Web3Auth Google login
 * cannot trigger MetaMask `connect` / `eth_requestAccounts`.
 * @param operation - Async work to run while MetaMask is isolated.
 */
export async function withoutInjectedEthereum<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof window === "undefined") {
    return operation();
  }

  const win = window as WindowWithEthereum;
  const original = win.ethereum;
  if (!original) {
    return operation();
  }

  const request = original.request?.bind(original);
  const connect = original.connect?.bind(original);
  const enable = original.enable?.bind(original);
  const send = original.send?.bind(original);
  const sendAsync = original.sendAsync?.bind(original);

  original.request = async (args: { method?: string; params?: unknown }) => {
    const method = String(args?.method ?? "");
    if (isInjectedEvmMethod(method)) {
      return stubEvmResponse(method);
    }
    if (request) return request(args);
    return null;
  };

  original.connect = async () => ({ accounts: [] });
  original.enable = async () => [];

  if (typeof send === "function") {
    original.send = (methodOrPayload: unknown, ...rest: unknown[]) => {
      if (typeof methodOrPayload === "string") {
        if (isInjectedEvmMethod(methodOrPayload)) {
          return Promise.resolve(stubEvmResponse(methodOrPayload));
        }
      } else if (
        methodOrPayload &&
        typeof methodOrPayload === "object" &&
        "method" in methodOrPayload
      ) {
        const method = String(
          (methodOrPayload as { method?: string }).method ?? "",
        );
        if (isInjectedEvmMethod(method)) {
          const cb = rest[0];
          if (typeof cb === "function") {
            (cb as (err: null, result: unknown) => void)(null, {
              id: (methodOrPayload as { id?: number }).id ?? 1,
              jsonrpc: "2.0",
              result: stubEvmResponse(method),
            });
            return;
          }
          return Promise.resolve({
            id: (methodOrPayload as { id?: number }).id ?? 1,
            jsonrpc: "2.0",
            result: stubEvmResponse(method),
          });
        }
      }
      return send(methodOrPayload, ...rest);
    };
  }

  if (typeof sendAsync === "function") {
    original.sendAsync = ((
      payload: { method?: string; id?: number },
      callback: (err: Error | null, result?: unknown) => void,
    ) => {
      const method = String(payload?.method ?? "");
      if (isInjectedEvmMethod(method)) {
        callback(null, {
          id: payload?.id ?? 1,
          jsonrpc: "2.0",
          result: stubEvmResponse(method),
        });
        return;
      }
      return sendAsync(payload, callback);
    }) as EthereumLike["sendAsync"];
  }

  try {
    return await operation();
  } finally {
    if (request) original.request = request;
    else delete original.request;

    if (connect) original.connect = connect;
    else delete original.connect;

    if (enable) original.enable = enable;
    else delete original.enable;

    if (send) original.send = send;
    else delete original.send;

    if (sendAsync) original.sendAsync = sendAsync;
    else delete original.sendAsync;
  }
}

/**
 * Inline bootstrap source for Next.js `beforeInteractive` Script.
 * Swallows MetaMask extension rejections before React hydrates.
 */
export const METAMASK_NOISE_BOOTSTRAP_SCRIPT = `
(function () {
  if (typeof window === "undefined") return;
  var EXT = "nkbihfbeogaeaoehlefnkodbefgpgknn";
  function isNoise(value) {
    try {
      var text = "";
      if (value && typeof value === "object") {
        text = String(value.message || "") + " " + String(value.stack || "");
      } else {
        text = String(value || "");
      }
      text = text.toLowerCase();
      return (
        text.indexOf("failed to connect to metamask") !== -1 ||
        text.indexOf("metamask") !== -1 ||
        text.indexOf(EXT) !== -1 ||
        text.indexOf("chrome-extension://" + EXT) !== -1 ||
        text.indexOf("eth_requestaccounts") !== -1 ||
        text.indexOf("already processing eth_requestaccounts") !== -1
      );
    } catch (_) {
      return false;
    }
  }
  function onRejection(event) {
    if (!isNoise(event.reason)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function onError(event) {
    if (!isNoise(event.error || event.message)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  window.addEventListener("unhandledrejection", onRejection, true);
  window.addEventListener("error", onError, true);
})();
`.trim();
