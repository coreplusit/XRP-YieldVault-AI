import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "XRP YieldVault dashboard — deposit into native XRPL escrows and verify on-chain.",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton titleWidth="w-40" cards={3} />}>
      <DashboardClient />
    </Suspense>
  );
}
