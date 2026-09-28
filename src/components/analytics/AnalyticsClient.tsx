"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { appConfig } from "@/lib/config/env";
import { INVESTOR_TOOLTIPS } from "@/lib/copy/investorTooltips";
import {
  buildYieldProjections,
  usdToXrp,
} from "@/lib/vault/yield";

const MIN_DEPOSIT_USD = appConfig.vault.minDepositUsd;
const MAX_DEPOSIT_USD = 10_000;
const SLIDER_STEP_USD = 50;

/**
 * Investor-grade Yield Calculator / Growth Visualizer.
 * Client-only math — no blocking network calls.
 */
export function AnalyticsClient() {
  const [depositUsd, setDepositUsd] = useState<number>(
    Math.max(MIN_DEPOSIT_USD, 500),
  );

  const principalXrp = useMemo(
    () => usdToXrp(depositUsd, appConfig.vault.xrpUsdPrice),
    [depositUsd],
  );

  const projections = useMemo(
    () =>
      buildYieldProjections(
        principalXrp,
        appConfig.vault.apyPercent,
        appConfig.vault.xrpUsdPrice,
      ),
    [principalXrp],
  );

  /** Default breakdown uses the vault lock window (30-day) projection. */
  const lockProjection = projections[0] ?? {
    label: "30 Days",
    days: 30,
    yieldXrp: 0,
    totalXrp: principalXrp,
    yieldUsd: 0,
    totalUsd: principalXrp * appConfig.vault.xrpUsdPrice,
    compounding: "simple" as const,
  };
  const principalShare =
    lockProjection.totalXrp > 0
      ? (principalXrp / lockProjection.totalXrp) * 100
      : 100;
  const yieldShare = 100 - principalShare;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
          Analytics
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Yield Calculator
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-vault-muted">
          Model estimated returns at the{" "}
          {appConfig.vault.apyPercent}% display APY. Figures are illustrative —
          XRPL native escrow locks principal; yield is synced off-ledger via
          treasury operations.
        </p>
      </div>

      {/* Deposit slider */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
              Deposit Amount
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Interactive Growth Visualizer
            </h2>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold text-white">
              ${depositUsd.toLocaleString()}
            </p>
            <p className="mt-1 font-mono text-xs text-vault-muted">
              ≈{" "}
              {principalXrp.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              XRP @ ${appConfig.vault.xrpUsdPrice}
            </p>
          </div>
        </div>

        <label className="mt-6 block">
          <span className="sr-only">Deposit amount in USD</span>
          <input
            type="range"
            min={MIN_DEPOSIT_USD}
            max={MAX_DEPOSIT_USD}
            step={SLIDER_STEP_USD}
            value={depositUsd}
            onChange={(event) => setDepositUsd(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-vault-teal"
          />
        </label>
        <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-vault-muted">
          <span>${MIN_DEPOSIT_USD.toLocaleString()}</span>
          <span>$5,000</span>
          <span>${MAX_DEPOSIT_USD.toLocaleString()}+</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[100, 500, 1_000, 2_500, 5_000, 10_000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDepositUsd(preset)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                depositUsd === preset
                  ? "border-vault-teal/40 bg-vault-teal/10 text-vault-teal"
                  : "border-slate-800/60 text-vault-muted hover:border-vault-cyan/30 hover:text-white"
              }`}
            >
              ${preset.toLocaleString()}
            </button>
          ))}
        </div>
      </section>

      {/* APY projection cards */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TrendingUp className="h-4 w-4 text-vault-teal" aria-hidden="true" />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Dynamic APY Projections · {appConfig.vault.apyPercent}% Base Rate
          </p>
          <InfoTooltip
            label="What is the APY base rate?"
            content={INVESTOR_TOOLTIPS.apyBaseRate(appConfig.vault.apyPercent)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {projections.map((projection) => (
            <article
              key={projection.label}
              className="glass-panel rounded-2xl p-5 transition-colors hover:border-vault-teal/30"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{projection.label}</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-vault-muted">
                  {projection.compounding === "monthly"
                    ? "Compounded"
                    : "Pro-rata"}
                  {projection.compounding === "monthly" ? (
                    <InfoTooltip
                      label="What is compounded yield?"
                      preferredPlacement="bottom"
                      content={INVESTOR_TOOLTIPS.compoundedYield}
                    />
                  ) : null}
                </span>
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-wider text-vault-muted">
                Estimated Yield
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold text-vault-teal">
                +
                {projection.yieldXrp.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}{" "}
                <span className="text-sm text-vault-muted">XRP</span>
              </p>
              <p className="mt-1 text-xs text-vault-muted">
                ≈ $
                {projection.yieldUsd.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
              <div className="mt-4 border-t border-slate-800/60 pt-3">
                <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                  Ending Balance
                </p>
                <p className="mt-1 font-mono text-lg text-white">
                  {projection.totalXrp.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  XRP
                </p>
                <p className="text-xs text-vault-muted">
                  $
                  {projection.totalUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Principal vs Yield breakdown */}
      <section className="glass-panel mt-6 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-vault-cyan" aria-hidden="true" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
                Growth Breakdown
              </p>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
                Principal vs Guaranteed Yield
                <InfoTooltip
                  label="What is escrow time-lock?"
                  content={INVESTOR_TOOLTIPS.growthBreakdown(
                    appConfig.vault.lockDays,
                  )}
                />
              </h2>
            </div>
          </div>
          <p className="text-xs text-vault-muted">
            Based on {lockProjection.label} lock window
          </p>
        </div>

        <div className="mt-6">
          <div
            className="flex h-4 min-w-0 overflow-hidden rounded-full border border-slate-800/60 bg-vault-bg/60"
            role="img"
            aria-label={`Principal ${principalShare.toFixed(1)} percent, yield ${yieldShare.toFixed(1)} percent`}
          >
            <div
              className="bg-gradient-to-r from-slate-500 to-slate-400 transition-all duration-500"
              style={{ width: `${principalShare}%` }}
            />
            <div
              className="bg-gradient-to-r from-vault-teal to-vault-cyan transition-all duration-500"
              style={{ width: `${yieldShare}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                  Principal
                </p>
              </div>
              <p className="mt-2 font-mono text-xl font-semibold text-white">
                {principalXrp.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}{" "}
                XRP
              </p>
              <p className="mt-1 text-xs text-vault-muted">
                {principalShare.toFixed(1)}% of ending balance · $
                {depositUsd.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-vault-teal/20 bg-vault-teal/5 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-vault-teal" />
                <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                  Guaranteed Yield (est.)
                </p>
              </div>
              <p className="mt-2 font-mono text-xl font-semibold text-vault-teal">
                +
                {lockProjection.yieldXrp.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}{" "}
                XRP
              </p>
              <p className="mt-1 text-xs text-vault-muted">
                {yieldShare.toFixed(1)}% of ending balance · $
                {lockProjection.yieldUsd.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-vault-muted">
          Not financial advice. Principal remains self-custodied in XRPL EscrowCreate
          until unlock. Yield estimates assume continuous treasury performance at the
          stated APY and may differ from realized returns.
        </p>
      </section>
    </div>
  );
}
