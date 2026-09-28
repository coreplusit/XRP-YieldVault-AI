import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * Instant soft-nav placeholder while the profile segment resolves.
 */
export default function ProfileLoading() {
  return <PageSkeleton titleWidth="w-56" cards={2} />;
}
