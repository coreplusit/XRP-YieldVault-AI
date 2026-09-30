/**
 * Lightweight skeleton placeholders for App Router `loading.tsx` soft navigations.
 */
export function PageSkeleton({
  titleWidth = "w-48",
  cards = 3,
}: {
  titleWidth?: string;
  cards?: number;
}) {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 rounded bg-slate-800/80" />
        <div className={`h-8 ${titleWidth} rounded-lg bg-slate-800/80`} />
        <div className="h-4 w-72 max-w-full rounded bg-slate-800/60" />
      </div>
      <div
        className={`mb-6 grid gap-3 ${cards >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={`skel-card-${index}`}
            className="glass-panel h-28 rounded-2xl p-5"
          >
            <div className="mb-3 h-8 w-8 rounded-lg bg-slate-800/80" />
            <div className="h-3 w-16 rounded bg-slate-800/60" />
            <div className="mt-3 h-7 w-24 rounded bg-slate-800/80" />
          </div>
        ))}
      </div>
      <div className="glass-panel h-64 rounded-2xl p-6">
        <div className="h-3 w-28 rounded bg-slate-800/80" />
        <div className="mt-6 space-y-3">
          <div className="h-10 w-full rounded-xl bg-slate-800/60" />
          <div className="h-10 w-full rounded-xl bg-slate-800/60" />
          <div className="h-10 w-2/3 rounded-xl bg-slate-800/60" />
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder rows for tables that load XRPL or Supabase data after navigation.
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`table-skel-${index}`}
          className="h-12 w-full rounded-xl bg-slate-800/70"
        />
      ))}
    </div>
  );
}
