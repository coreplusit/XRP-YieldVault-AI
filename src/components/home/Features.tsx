import { BarChart3, Lock, Vote } from "lucide-react";

interface FeatureCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}

const FEATURES: readonly FeatureCard[] = [
  {
    id: "escrows",
    icon: <Lock className="h-5 w-5" aria-hidden="true" />,
    title: "Native XRPL Escrows",
    description:
      "Zero smart contract risk using on-chain time-locks. Funds secured directly by the XRP Ledger protocol.",
    accent: "from-vault-cyan/20 to-transparent",
  },
  {
    id: "risk-rating",
    icon: <BarChart3 className="h-5 w-5" aria-hidden="true" />,
    title: "Algorithmic Risk Rating",
    description:
      "On-chain liquidity evaluation and transparent APY calculation powered by real-time XRPL metrics.",
    accent: "from-vault-teal/20 to-transparent",
  },
  {
    id: "dao-voting",
    icon: <Vote className="h-5 w-5" aria-hidden="true" />,
    title: "Tokenized DAO Voting",
    description:
      "Proportional voting power mapped directly to active deposits. Treasury strategy follows community consensus.",
    accent: "from-vault-cyan/10 via-vault-teal/10 to-transparent",
  },
] as const;

/**
 * Architecture highlights grid — three core protocol capabilities.
 */
export function Features() {
  return (
    <section id="governance" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vault-cyan">
            Protocol Architecture
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built on XRPL primitives,{" "}
            <span className="text-gradient-neon">not smart contracts</span>
          </h2>
          <p className="mt-4 text-vault-muted">
            Every layer leverages native ledger features for security, transparency,
            and predictable yield mechanics.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.id}
              className="glass-panel glass-panel-hover group relative overflow-hidden rounded-2xl p-6"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${feature.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                aria-hidden="true"
              />
              <div className="relative">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800/60 bg-vault-bg/60 text-vault-cyan">
                    {feature.icon}
                  </div>
                  <span className="font-mono text-xs text-vault-muted/60">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-vault-muted">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
