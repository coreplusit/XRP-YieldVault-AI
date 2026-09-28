/**
 * High-trust investor copy for InfoTooltips across the console.
 * Emphasizes Non-Custodial custody, XRPL Native Escrow, and Automated Treasury Strategies.
 */

export const INVESTOR_TOOLTIPS = {
  apyBaseRate: (apyPercent: number): string =>
    `${apyPercent}% display APY is an Automated Treasury Strategies target — not ledger-minted yield. Principal stays Non-Custodial in XRPL Native Escrow while treasury arbitrage syncs returns off-ledger.`,

  escrowTimeLock: (lockDays: number): string =>
    `XRPL Native Escrow time-locks principal for ${lockDays} days via EscrowCreate. Non-Custodial by design: YieldVault cannot withdraw early — unlock is enforced on-ledger.`,

  nonCustodialModel:
    "Non-Custodial: your XRP is locked in XRPL Native Escrow under your keys. Operators cannot seize, rehypothecate, or unilaterally unlock deposits.",

  zeroCounterparty:
    "Zero counterparty risk on principal: XRPL Native Escrow enforces unlock conditions at consensus. The dApp never holds custody of escrowed funds.",

  yieldSync:
    "Automated Treasury Strategies (arbitrage & liquidity rebalancing) sync display APY against Non-Custodial escrowed principal. Escrow itself does not mint yield on XRPL.",

  compoundedYield:
    "Compounded projections assume monthly reinvestment of estimated yield from Automated Treasury Strategies. Principal modeling remains Non-Custodial XRPL Native Escrow.",

  staking:
    "Staked $VAULT aligns long-term governance. Voting rights stay separate from Non-Custodial XRPL Native Escrow — staking never moves your escrowed XRP.",

  votingPower: (vpPerDeposit: number): string =>
    `Voting Power = active XRPL Native Escrow deposits × ${vpPerDeposit} VP. Your principal stays Non-Custodial; VP only weights DAO votes.`,

  delegation:
    "Delegation passes Voting Power to a trusted community or AI delegate without risking or moving escrowed funds — Non-Custodial XRPL Native Escrow remains untouched.",

  proposals:
    "DAO proposals set fees, APY strategy, and treasury policy. Vote in 1 click or delegate. Quorum badges show when participation thresholds are met — escrowed principal stays Non-Custodial.",

  growthBreakdown: (lockDays: number): string =>
    `Principal vs Guaranteed Yield models a ${lockDays}-day XRPL Native Escrow lock. Yield estimates reflect Automated Treasury Strategies; principal stays Non-Custodial on-ledger.`,
} as const;
