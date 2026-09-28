import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * Instant soft-nav placeholder while the dashboard segment resolves.
 */
export default function DashboardLoading() {
  return <PageSkeleton titleWidth="w-40" cards={3} />;
}
