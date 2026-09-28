import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * Instant soft-nav placeholder while the history segment resolves.
 */
export default function HistoryLoading() {
  return <PageSkeleton titleWidth="w-64" cards={1} />;
}
