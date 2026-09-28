import type { Metadata } from "next";

import { ProfileClient } from "@/components/profile/ProfileClient";

export const metadata: Metadata = {
  title: "Profile & Security",
  description:
    "Manage your YieldVault Google identity, XRPL self-custody wallet, and sessions.",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
