# XRP YieldVault AI

A decentralized yield optimization platform built on the XRP Ledger (XRPL) ecosystem with automated risk assessment and strategy evaluation.

## Architecture & Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3 Integration**: XRPL JavaScript SDK (`xrpl`), `@web3auth/modal`, `@web3auth/xrpl-provider`
- **Process Management**: PM2
- **Reverse Proxy**: Nginx

## Repository Structure
├── docs/                 # System architecture and workflow diagrams
├── scripts/              # Utility and deployment scripts
├── src/
│   ├── app/              # Next.js App Router pages and API routes
│   ├── components/       # UI components and wallet connection flows
│   └── lib/              # XRPL client setup, providers, and AI logic
├── .env.example          # Environment variable template
├── next.config.ts        # Next.js configuration
├── tailwind.config.ts    # Tailwind styling rules
└── tsconfig.json         # TypeScript rules

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/coreplusit/XRP-YieldVault-AI.git](https://github.com/coreplusit/XRP-YieldVault-AI.git)
   cd XRP-YieldVault-AI

   npm install --legacy-peer-deps
   cp .env.example .env.local
   # Generate production build
npm run build

# Start with PM2 on a custom port (e.g., 3001)
PORT=3001 pm2 start npm --name "xrp-yield-ai" -- start
