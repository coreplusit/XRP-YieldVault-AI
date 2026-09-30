import type { Metadata } from "next";
import { Suspense } from "react";

import { GovernanceClient } from "@/components/governance/GovernanceClient";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "DAO Governance",
  description:
    "Vote on YieldVault proposals — APY strategy, fees, and treasury allocation.",
};

export default function GovernancePage() {
  return (
    <Suspense fallback={<PageSkeleton titleWidth="w-48" cards={3} />}>
      <GovernanceClient />
    </Suspense>
  );
}
