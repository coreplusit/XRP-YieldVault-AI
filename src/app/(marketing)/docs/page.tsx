import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "XRP YieldVault AI documentation — XRPL Native Escrow, yield model, and DAO governance overview.",
};

/**
 * Public documentation landing for marketing-header "Documentation" nav.
 */
export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
        Documentation
      </p>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
        YieldVault Protocol Docs
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-vault-muted">
        Quick reference for investors and builders. Principal is locked via{" "}
        <span className="text-emerald-400">XRPL Native Escrow</span> in a
        non-custodial model; display APY is synced through automated treasury
        strategies.
      </p>

      <ul className="mt-10 space-y-4">
        {[
          {
            title: "Vaults & Escrow",
            href: "/dashboard",
            body: "Deposit XRP into time-locked EscrowCreate positions and verify on-chain proofs.",
          },
          {
            title: "DAO Governance",
            href: "/governance",
            body: "Vote on proposals, review quorum status, or delegate voting power.",
          },
          {
            title: "Yield Calculator",
            href: "/analytics",
            body: "Model 15% APY projections — principal vs estimated guaranteed yield.",
          },
        ].map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch
              className="glass-panel block rounded-2xl p-5 transition-colors hover:border-vault-teal/30"
            >
              <h2 className="text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-1 text-sm text-vault-muted">{item.body}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-xs text-vault-muted">
        Console routes require Google / Web3Auth sign-in. Unauthenticated visits
        are redirected to the marketing home.
      </p>
    </div>
  );
}
