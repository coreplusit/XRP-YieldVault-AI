/**
 * Pure yield math helpers for the investor Growth Visualizer.
 * Display estimates only — XRPL escrow does not mint yield on-chain.
 */

export interface YieldHorizonProjection {
  label: string;
  days: number;
  yieldXrp: number;
  totalXrp: number;
  yieldUsd: number;
  totalUsd: number;
  compounding: "simple" | "monthly";
}

/**
 * Pro-rata simple interest over a day count at a given APY.
 * @param principalXrp - Locked principal in XRP.
 * @param apyPercent - Annual percentage yield (e.g. 15).
 * @param days - Holding period in days.
 */
export function simplePeriodYield(
  principalXrp: number,
  apyPercent: number,
  days: number,
): number {
  if (![principalXrp, apyPercent, days].every(Number.isFinite)) return 0;
  if (principalXrp <= 0 || days <= 0) return 0;
  return principalXrp * (apyPercent / 100) * (days / 365);
}

/**
 * Monthly-compounded yield over N months at a given APY.
 * @param principalXrp - Locked principal in XRP.
 * @param apyPercent - Annual percentage yield (e.g. 15).
 * @param months - Number of monthly compounding periods.
 */
export function compoundMonthlyYield(
  principalXrp: number,
  apyPercent: number,
  months: number,
): number {
  if (![principalXrp, apyPercent, months].every(Number.isFinite)) return 0;
  if (principalXrp <= 0 || months <= 0) return 0;
  const rate = apyPercent / 100 / 12;
  return principalXrp * (Math.pow(1 + rate, months) - 1);
}

/**
 * Builds 30-day / 6-month / 1-year projection cards for the visualizer.
 * @param principalXrp - Deposit principal in XRP.
 * @param apyPercent - Base display APY.
 * @param xrpUsdPrice - FX used for USD display figures.
 */
export function buildYieldProjections(
  principalXrp: number,
  apyPercent: number,
  xrpUsdPrice: number,
): readonly YieldHorizonProjection[] {
  const horizons: ReadonlyArray<{
    label: string;
    days: number;
    months?: number;
    compounding: "simple" | "monthly";
  }> = [
    { label: "30 Days", days: 30, compounding: "simple" },
    { label: "6 Months", days: 182, months: 6, compounding: "monthly" },
    { label: "1 Year", days: 365, months: 12, compounding: "monthly" },
  ];

  return horizons.map((horizon) => {
    const yieldXrp =
      horizon.compounding === "monthly" && horizon.months
        ? compoundMonthlyYield(principalXrp, apyPercent, horizon.months)
        : simplePeriodYield(principalXrp, apyPercent, horizon.days);
    const totalXrp = principalXrp + yieldXrp;
    return {
      label: horizon.label,
      days: horizon.days,
      yieldXrp,
      totalXrp,
      yieldUsd: yieldXrp * xrpUsdPrice,
      totalUsd: totalXrp * xrpUsdPrice,
      compounding: horizon.compounding,
    };
  });
}

/**
 * Converts a USD deposit notional into approximate XRP using the display price.
 * @param usdAmount - USD notional from the slider.
 * @param xrpUsdPrice - Assumed XRP/USD price.
 */
export function usdToXrp(usdAmount: number, xrpUsdPrice: number): number {
  if (!Number.isFinite(usdAmount) || !Number.isFinite(xrpUsdPrice) || xrpUsdPrice <= 0) {
    return 0;
  }
  return usdAmount / xrpUsdPrice;
}
