import { ChainIcon } from "@/components/ui/ChainIcon";
import { appConfig } from "@/lib/config/env";

/**
 * Site-wide footer with network context and navigation anchors.
 */
export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      id="documentation"
      className="relative border-t border-slate-800/60 bg-vault-bg/80 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <ChainIcon className="h-6 w-6 opacity-70" />
          <div>
            <p className="text-sm font-medium text-white">XRP YieldVault</p>
            <p className="text-xs text-vault-muted">
              Native escrow yield protocol on XRPL
            </p>
          </div>
        </div>

        <p className="text-xs text-vault-muted">
          &copy; {currentYear} {appConfig.appName}. All rights reserved.
        </p>

        <p className="font-mono text-[10px] uppercase tracking-widest text-vault-muted">
          Network:{" "}
          <span className="text-vault-teal">{appConfig.xrpl.network}</span>
        </p>
      </div>
    </footer>
  );
}
