import type { Metadata } from "next";

import { GovernanceClient } from "@/components/governance/GovernanceClient";

export const metadata: Metadata = {
  title: "DAO Governance",
  description:
    "Vote on YieldVault proposals — APY strategy, fees, and treasury allocation.",
};

export default function GovernancePage() {
  return <GovernanceClient />;
}
