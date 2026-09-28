import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * Instant soft-nav placeholder while the governance segment resolves.
 */
export default function GovernanceLoading() {
  return <PageSkeleton titleWidth="w-48" cards={3} />;
}
