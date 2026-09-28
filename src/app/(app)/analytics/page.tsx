import type { Metadata } from "next";

import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";

export const metadata: Metadata = {
  title: "Yield Calculator",
  description:
    "Interactive APY growth visualizer — 30-day, 6-month, and 1-year compounding projections.",
};

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
