import { Activity, Layers, Zap } from "lucide-react";

interface OnChainStat {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
}

/** Static launch metrics — will be replaced by live XRPL indexer data. */
const ON_CHAIN_STATS: readonly OnChainStat[] = [
  {
    id: "tvl",
    label: "Total Value Locked",
    value: "1,250,000 XRP",
    icon: <Layers className="h-4 w-4" aria-hidden="true" />,
  },
  {
    id: "escrows",
    label: "Active Vault Escrows",
    value: "3,420",
    icon: <Activity className="h-4 w-4" aria-hidden="true" />,
  },
  {
    id: "fee",
    label: "Avg Network Fee",
    value: "~0.000012 XRP",
    icon: <Zap className="h-4 w-4" aria-hidden="true" />,
  },
] as const;

/**
 * Horizontal on-chain metrics bar displayed below the hero section.
 */
export function StatsBar() {
  return (
    <section id="analytics" aria-label="On-chain metrics" className="relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="grid divide-y divide-slate-800/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {ON_CHAIN_STATS.map((stat) => (
              <div
                key={stat.id}
                className="flex items-center gap-4 px-6 py-5 sm:px-8 sm:py-6"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-vault-cyan/20 bg-vault-cyan/5 text-vault-cyan">
                  {stat.icon}
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-vault-muted">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-white sm:text-xl">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
