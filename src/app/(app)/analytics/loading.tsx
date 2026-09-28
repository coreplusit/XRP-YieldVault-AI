import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * Instant soft-nav placeholder while the analytics segment resolves.
 */
export default function AnalyticsLoading() {
  return <PageSkeleton titleWidth="w-52" cards={1} />;
}
