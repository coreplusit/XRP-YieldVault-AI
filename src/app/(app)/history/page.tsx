import type { Metadata } from "next";

import { HistoryClient } from "@/components/history/HistoryClient";

export const metadata: Metadata = {
  title: "Transaction History",
  description:
    "Unified XRPL escrow, DAO vote, and delegation activity with explorer links.",
};

export default function HistoryPage() {
  return <HistoryClient />;
}
