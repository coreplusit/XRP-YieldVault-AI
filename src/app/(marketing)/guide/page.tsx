import type { Metadata } from "next";

import { DemoGuide } from "@/components/docs/DemoGuide";

export const metadata: Metadata = {
  title: "Platform Guide",
  description:
    "An interactive, step-by-step walkthrough of non-custodial onboarding, native XRPL escrow locks, dynamic yield analytics, and DAO governance.",
};

export default function PlatformGuidePage() {
  return <DemoGuide />;
}
