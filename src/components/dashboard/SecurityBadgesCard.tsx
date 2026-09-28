import type { ReactNode } from "react";
import { Lock, ShieldCheck, Zap } from "lucide-react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { INVESTOR_TOOLTIPS } from "@/lib/copy/investorTooltips";

interface TrustBadge {
  title: string;
  description: string;
  icon: ReactNode;
  accent: string;
  tooltip: string;
}

/**
 * Institutional Web3 Trust & Security badge card for investor transparency.
 */
export function SecurityBadgesCard() {
  const badges: readonly TrustBadge[] = [
    {
      title: "100% Non-Custodial",
      description:
        "Principal locked at protocol-level via XRPL Native Escrow. Your keys, your funds — YieldVault never holds custody.",
      icon: <Lock className="h-4 w-4" aria-hidden="true" />,
      accent: "border-vault-cyan/20 bg-vault-cyan/5 text-vault-cyan",
      tooltip: INVESTOR_TOOLTIPS.nonCustodialModel,
    },
    {
      title: "Zero Counterparty Risk",
      description:
        "The dApp cannot access or withdraw user principal. EscrowCreate enforces unlock conditions on-ledger.",
      icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
      accent: "border-vault-teal/20 bg-vault-teal/5 text-vault-teal",
      tooltip: INVESTOR_TOOLTIPS.zeroCounterparty,
    },
    {
      title: "Automated Yield Sync",
      description:
        "Backed by Treasury Arbitrage & Liquidity Rebalancing. Display APY is synced off-ledger against escrowed principal.",
      icon: <Zap className="h-4 w-4" aria-hidden="true" />,
      accent: "border-amber-400/20 bg-amber-400/5 text-amber-200",
      tooltip: INVESTOR_TOOLTIPS.yieldSync,
    },
  ];

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Institutional Security
          </p>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-white">
            Web3 Trust & Security
            <InfoTooltip
              label="What is the non-custodial model?"
              content={INVESTOR_TOOLTIPS.nonCustodialModel}
            />
          </h2>
          <p className="mt-1 max-w-xl text-sm text-vault-muted">
            Transparent escrow model designed for allocator diligence —
            principal integrity is enforced by the XRP Ledger, not by YieldVault
            operators.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-vault-teal/30 bg-vault-teal/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-vault-teal">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Audit-ready model
        </span>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {badges.map((badge) => (
          <li
            key={badge.title}
            className="rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${badge.accent}`}
              >
                {badge.icon}
              </div>
              <InfoTooltip label={`About ${badge.title}`} content={badge.tooltip} />
            </div>
            <h3 className="text-sm font-semibold text-white">{badge.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-vault-muted">
              {badge.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
