import type { Metadata } from "next";

import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "XRP YieldVault dashboard — deposit into native XRPL escrows and verify on-chain.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
