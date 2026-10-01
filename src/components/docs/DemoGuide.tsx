import Image from "next/image";
import Link from "next/link";

interface GuideFigure {
  file: string;
  alt: string;
  width: number;
  height: number;
}

interface GuideNote {
  label: string;
  body: string;
}

interface GuideSection {
  id: string;
  step: string;
  title: string;
  href: string;
  hrefLabel: string;
  lead: string;
  figures: readonly GuideFigure[];
  notes: readonly GuideNote[];
}

const SECTIONS: readonly GuideSection[] = [
  {
    id: "overview",
    step: "01",
    title: "App overview and onboarding",
    href: "/dashboard",
    hrefLabel: "Open Dashboard",
    lead: "The dashboard is the signed-in home. A four-step journey tracks Google login, a Testnet faucet claim, an XRPL escrow lock, and the voting power that lock unlocks. Live XRP balance and governance totals refresh from the ledger and from Supabase without blocking navigation.",
    figures: [
      {
        file: "dashbord.png",
        alt: "YieldVault dashboard with onboarding steps, live balance, and vault stats",
        width: 1351,
        height: 614,
      },
    ],
    notes: [
      {
        label: "User journey",
        body: "Sign in with Google through Web3Auth, claim Testnet XRP, lock XRP in a native escrow, then cast or delegate votes with the voting power that escrow creates. One escrowed XRP equals one voting power.",
      },
      {
        label: "XRPL",
        body: "Balances come from account_info on the locked Testnet cluster (wss://s.altnet.rippletest.net:51233). The faucet proxy funds the classic address derived from the Web3Auth key. The product claim is 200 Testnet XRP.",
      },
      {
        label: "Supabase",
        body: "The signed-in wallet is synced to public.users. Vault totals, proposal tallies, and the user’s votes are read after that session exists, so the dashboard can show deposited XRP and voting power beside the live ledger balance.",
      },
    ],
  },
  {
    id: "profile",
    step: "02",
    title: "Profile and XRPL wallet",
    href: "/profile",
    hrefLabel: "Open Profile",
    lead: "Profile is the self-custody account card. Google login never creates a custodial wallet on a YieldVault server. Web3Auth returns a private key in the browser, and the app derives a deterministic XRPL classic address from that key.",
    figures: [
      {
        file: "profile-security.png",
        alt: "Profile and security card with Web3Auth identity and live XRP balance",
        width: 1345,
        height: 603,
      },
      {
        file: "add-xrp-in wallet.png",
        alt: "Testnet faucet claim and QR code for the XRPL address",
        width: 1047,
        height: 524,
      },
    ],
    notes: [
      {
        label: "Web3Auth",
        body: "Login uses the Auth adapter on Sapphire Devnet. The same Google identity always maps to the same XRPL address because the wallet is built from the provider’s key entropy.",
      },
      {
        label: "Faucet and QR",
        body: "Claim 200 Free Testnet XRP calls POST /api/xrpl/faucet with a signature from the connected wallet, then polls account_info until the balance updates. The QR encodes the classic address so another Testnet wallet can pay it.",
      },
      {
        label: "What you keep",
        body: "The address, live balance, auth provider, and escrow stats stay on one screen. YieldVault cannot move the XRP. Only a transaction signed in this browser can.",
      },
    ],
  },
  {
    id: "export",
    step: "03",
    title: "Self-custody and key export",
    href: "/profile",
    hrefLabel: "Open Profile",
    lead: "Export reveals the XRPL family seed when the derived wallet has one, otherwise the private key. Derivation happens locally after you are connected. The secret is shown only after you choose Reveal, and the copy action warns you to clear the clipboard.",
    figures: [
      {
        file: "export-wallet.png",
        alt: "Export wallet dialog for the XRPL family seed",
        width: 1325,
        height: 408,
      },
    ],
    notes: [
      {
        label: "Key handling",
        body: "The seed or private key is derived in the browser from the Web3Auth provider. It is not written to Supabase and it is not sent to the faucet or governance APIs.",
      },
      {
        label: "Session",
        body: "The connected session shows the Google profile and the XRPL address that matches the key. Logout clears the local Web3Auth session and the app’s Supabase session header.",
      },
      {
        label: "Why it matters",
        body: "You can import the family seed into another XRPL wallet and keep the same Testnet account. That is the self-custody exit: the escrow and the XRP stay under the key you can export.",
      },
    ],
  },
  {
    id: "escrow",
    step: "04",
    title: "Yield vault and native escrow",
    href: "/dashboard",
    hrefLabel: "Open Dashboard",
    lead: "Deposit signs a native XRPL EscrowCreate. The XRP leaves the spendable balance and sits in a ledger escrow until FinishAfter. YieldVault cannot finish or cancel that escrow early. The lock used by the product is 30 days.",
    figures: [
      {
        file: "amount-add-escrow.png",
        alt: "Escrow deposit form with amount, lock window, and voting power preview",
        width: 1282,
        height: 537,
      },
    ],
    notes: [
      {
        label: "On-chain",
        body: "The wallet signs EscrowCreate for the entered XRP amount with FinishAfter set from the lock window. After tesSUCCESS, the transaction hash is the on-chain proof. Display APY is not minted by the escrow.",
      },
      {
        label: "APY and reserve",
        body: "The screen shows a 15% display APY from automated treasury strategies, modeled off-ledger. The $100 minimum is a USD notional using the configured XRP price, not a ledger reserve. Spendable XRP still respects the 10 XRP base reserve.",
      },
      {
        label: "Voting power",
        body: "Supabase stores the deposit against your user id. Active escrowed XRP becomes voting power one-for-one. A later vote uses that sum, not a number typed in the browser.",
      },
    ],
  },
  {
    id: "withdraw",
    step: "05",
    title: "Withdraw / Send XRP Payments",
    href: "/profile",
    hrefLabel: "Open Profile",
    lead: "Withdraw / Send XRP covers both a withdrawal of funds to an external address and a direct XRP transfer on Testnet. You enter the destination classic address, an optional destination tag, and the amount. The form checks the tag and keeps the 10 XRP base reserve before the wallet signs a native Payment.",
    figures: [
      {
        file: "withdrawl-xrp.png",
        alt: "Withdraw modal with destination address, destination tag, and amount",
        width: 1146,
        height: 506,
      },
    ],
    notes: [
      {
        label: "Withdrawal and transfer",
        body: "Use this flow to withdraw XRP to an external wallet or to send a direct XRP payment to any classic address. The destination must be a different r-address. A destination tag is optional and, when set, must be an integer from 0 through 4294967295.",
      },
      {
        label: "Base reserve",
        body: "The form keeps 10 XRP aside for the ledger base reserve so a send cannot drop the account below the reserve and fail on-chain. Escrowed XRP is not part of this spendable balance.",
      },
      {
        label: "Supabase",
        body: "A successful payment can be logged in xrp_transfers for the history view. The ledger remains the source of truth: account_tx decides whether the row is shown as sent or received.",
      },
    ],
  },
  {
    id: "calculator",
    step: "06",
    title: "Interactive yield calculator",
    href: "/analytics",
    hrefLabel: "Open Yield Calculator",
    lead: "The growth visualizer is client-side math. A slider runs from the $100 minimum to $10,000 in $50 steps and converts USD to XRP at the display price. Nothing here is submitted to the ledger.",
    figures: [
      {
        file: "yield-calculator.png",
        alt: "Yield calculator slider with 30-day, 6-month, and 1-year projections",
        width: 1208,
        height: 496,
      },
    ],
    notes: [
      {
        label: "30-day pro-rata",
        body: "The lock-window card uses simple interest: principal × 15% × (30 / 365). That matches a single escrow period and does not compound inside the month.",
      },
      {
        label: "6-month and 1-year",
        body: "Longer cards compound monthly. Six months is six periods and one year is twelve, at a monthly rate of 15% / 12. The chart splits principal from estimated yield.",
      },
      {
        label: "What it is not",
        body: "EscrowCreate does not pay interest on XRPL. These figures are a display model of the 15% target. Principal stays in the native escrow until the finish time.",
      },
    ],
  },
  {
    id: "history",
    step: "07",
    title: "On-chain and off-chain history",
    href: "/history",
    hrefLabel: "Open History",
    lead: "History merges the XRPL account transaction list with Supabase rows for deposits, votes, delegations, and transfers. Incoming payments that are missing from the database are written back when the page loads. Each hash links to the Testnet explorer.",
    figures: [
      {
        file: "Transaction-history.png",
        alt: "Transaction history table with received, sent, and escrow rows",
        width: 1167,
        height: 468,
      },
    ],
    notes: [
      {
        label: "Ledger rows",
        body: "account_tx pages Payment and EscrowCreate results. A payment you sent is shown as Sent. A payment you received is shown as Received, with the counterparty address. Escrow creates are labeled Escrow Deposit.",
      },
      {
        label: "Supabase rows",
        body: "Votes, delegation changes, and stored transfers fill types the ledger request does not label by itself. If a ledger payment and a stored transfer share a hash, the ledger row wins.",
      },
      {
        label: "Explorer",
        body: "Every hash opens https://testnet.xrpl.org/transactions/… so a reviewer can confirm the same transaction on the public Testnet ledger.",
      },
    ],
  },
  {
    id: "governance",
    step: "08",
    title: "DAO governance and voting power",
    href: "/governance",
    hrefLabel: "Open DAO Governance",
    lead: "Governance lists proposals stored in Supabase: title, category, status, and yes / no / abstain tallies. Your voting power is the sum of active escrow deposits. Submitting a vote calls cast_governance_vote, which checks that you are the signed-in user and applies that escrow-backed power.",
    figures: [
      {
        file: "dao-goverance-dashboard.png",
        alt: "DAO governance dashboard with active proposals and voting power",
        width: 1344,
        height: 585,
      },
      {
        file: "submit-vote-to-dao.png",
        alt: "Vote confirmation on an active DAO proposal",
        width: 1140,
        height: 495,
      },
    ],
    notes: [
      {
        label: "Proposals",
        body: "Anyone with a session can submit a proposal. The list itself is public. Tallies change only inside the vote function, so a client cannot edit yes/no totals directly.",
      },
      {
        label: "Casting a vote",
        body: "Vote Yes, Vote No, or Abstain on an active proposal. Changing a vote removes the previous weight and adds the current escrow power. Closed proposals reject new votes.",
      },
      {
        label: "Power source",
        body: "Power is escrowed XRP, one for one, not a separate staked token. If nothing is locked, the vote is rejected. Delegation can point that same power at another address without moving the XRP.",
      },
    ],
  },
  {
    id: "delegate",
    step: "09",
    title: "Voting power delegation",
    href: "/governance",
    hrefLabel: "Open DAO Governance",
    lead: "Delegation assigns your voting power to a preset representative or to any classic XRPL address. The underlying escrow stays in your account. You can switch or clear the delegate without signing an XRPL payment.",
    figures: [
      {
        file: "delegate-voting-power.png",
        alt: "Delegate voting power modal with preset representatives and a custom address",
        width: 1158,
        height: 573,
      },
    ],
    notes: [
      {
        label: "Presets",
        body: "The modal offers the Treasury Strategy AI Delegate, the XRPL Foundation Delegate, and the YieldVault Council, plus a custom r-address. Preset addresses are display identities for the demo.",
      },
      {
        label: "State",
        body: "The choice is saved in user_delegations for your user id and mirrored in local storage so the governance screen can show it immediately. It does not create an escrow or a payment.",
      },
      {
        label: "Custody",
        body: "Delegating does not transfer XRP and does not give the delegate your seed. They receive the voting weight only. Your FinishAfter escrow and your spendable balance stay unchanged.",
      },
    ],
  },
];

/**
 * Public path for a screenshot stored under public/docs/images.
 * @param file - Filename, including spaces.
 */
function imageSrc(file: string): string {
  return `/docs/images/${encodeURIComponent(file)}`;
}

/**
 * Step-by-step reviewer walkthrough of the signed-in YieldVault console.
 */
export function DemoGuide() {
  return (
    <div className="mx-auto min-w-0 max-w-5xl overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
        XRP YieldVault AI — Platform Guide
      </p>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
        XRP YieldVault AI — Platform Guide
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-vault-muted">
        An interactive, step-by-step walkthrough of non-custodial onboarding,
        native XRPL escrow locks, dynamic yield analytics, and DAO governance.
      </p>

      <nav
        aria-label="Walkthrough sections"
        className="mt-6 flex max-w-full gap-2 overflow-x-auto pb-1"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full border border-slate-800/80 bg-vault-surface/40 px-3 py-1.5 font-mono text-[11px] text-vault-muted transition-colors hover:border-vault-teal/40 hover:text-white"
          >
            {section.step} {section.title}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <article
            key={section.id}
            id={section.id}
            className="glass-panel scroll-mt-24 rounded-2xl p-4 sm:p-6"
          >
            <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
                  Step {section.step}
                </p>
                <h2 className="mt-1 break-words text-xl font-semibold text-white sm:text-2xl">
                  {section.title}
                </h2>
              </div>
              <Link
                href={section.href}
                prefetch
                className="rounded-full border border-vault-teal/30 bg-vault-teal/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-vault-teal/20"
              >
                {section.hrefLabel}
              </Link>
            </div>

            <div className="space-y-4">
              {section.figures.map((figure) => (
                <figure
                  key={figure.file}
                  className="overflow-hidden rounded-xl border border-slate-800/80 bg-black/30 shadow-[0_24px_60px_-28px_rgba(45,212,191,0.45)]"
                >
                  <Image
                    src={imageSrc(figure.file)}
                    alt={figure.alt}
                    width={figure.width}
                    height={figure.height}
                    className="h-auto w-full"
                    sizes="(min-width: 1024px) 960px, 100vw"
                  />
                </figure>
              ))}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-slate-200">
              {section.lead}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {section.notes.map((note) => (
                <div
                  key={note.label}
                  className="rounded-xl border border-slate-800/70 bg-black/20 p-4"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vault-teal">
                    {note.label}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-vault-muted">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
