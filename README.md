# XRP YieldVault AI

A decentralized, AI-driven yield optimization and vault management platform built natively for the XRP Ledger (XRPL) ecosystem. It combines automated on-chain risk scoring, real-time APY analytics, and non-custodial Web3 wallet integration to optimize liquidity deployment across XRPL protocols.

 **Live Application**: [https://139.59.94.12.nip.io](https://139.59.94.12.nip.io)  
 **Interactive Platform Guide**: [https://139.59.94.12.nip.io/guide](https://139.59.94.12.nip.io/guide)

---

## Key Features & Functionality

- **Smart Vault Strategy Engine**: Automatically scans and evaluates XRPL liquidity pools and yield opportunities based on real-time market conditions.
- **AI Risk & Yield Scoring**: Evaluates pool volatility, impermanent loss probability, and historical returns using predictive scoring models.
- **Non-Custodial Web3 Auth**: Supports seamless social logins and non-custodial wallet connections powered by Web3Auth and XRPL providers.
- **Real-Time On-Chain Analytics**: Direct interaction with XRPL via official SDKs (`xrpl`) to fetch account balances, trustlines, and transaction history.
- **Automated Rebalancing Alerts**: Signals optimal liquidity repositioning to maximize APY while hedging against downside market risks.
- **Interactive Platform Walkthrough**: Built-in visual protocol guide at `/guide` walking through onboarding, escrow locks, governance, and withdrawals.

---

## Architecture & Tech Stack

- **Framework**: Next.js 14+ (App Router, Server Actions)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Lucide Icons
- **Web3 & XRPL Integration**: `xrpl` JavaScript SDK, `@web3auth/modal`, `@web3auth/xrpl-provider`
- **Server & Deployment**: Node.js, PM2 Process Manager, Nginx Reverse Proxy
- **Environment**: DigitalOcean VPS / Linux Ubuntu

---

## Repository Structure

- `src/`
  - `app/`: Next.js App Router pages, layout configurations, API endpoints, and the interactive `/guide` route.
  - `components/`: UI components, dashboard widgets, and wallet modal flows.
  - `lib/`: XRPL client connection utilities, AI yield algorithms, and provider configs.
- `scripts/`: Deployment scripts and automation tasks.
- `.env.example`: Environment variable template for credentials and RPC nodes.
- `next.config.ts`: Next.js build and image domain rules.
- `tailwind.config.ts`: Custom theme design tokens and color scales.
- `tsconfig.json`: Strict TypeScript compiler specifications.

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone [https://github.com/coreplusit/XRP-YieldVault-AI.git](https://github.com/coreplusit/XRP-YieldVault-AI.git)
   cd XRP-YieldVault-AI
