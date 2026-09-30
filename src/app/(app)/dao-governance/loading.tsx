import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * Shown while the governance alias redirect resolves.
 */
export default function DaoGovernanceLoading() {
  return <PageSkeleton titleWidth="w-48" cards={3} />;
}