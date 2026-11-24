export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-9 w-64 animate-pulse rounded-lg bg-ivory-200" />
      <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-[var(--radius-card)] bg-ivory-200" />)}</div>
      <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-ivory-200" />
    </div>
  );
}
