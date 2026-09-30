import type { Metadata } from "next";
import { Suspense } from "react";

import { HistoryClient } from "@/components/history/HistoryClient";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Transaction History",
  description:
    "Unified XRPL escrow, DAO vote, and delegation activity with explorer links.",
};

export default function HistoryPage() {
  return (
    <Suspense fallback={<PageSkeleton titleWidth="w-64" cards={1} />}>
      <HistoryClient />
    </Suspense>
  );
}
