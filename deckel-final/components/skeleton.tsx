/**
 * Loading placeholders drawn in the receipt language: ruled lines with an
 * amount on the right. Shown instantly by Next's loading.tsx while the
 * server renders, so a tap produces something on screen immediately
 * instead of a frozen page.
 */

export function SkeletonLine({ width = "60%" }: { width?: string }) {
  return (
    <div className="flex items-baseline py-2">
      <span className="shimmer h-3 rounded-sm" style={{ width }} />
      <span className="leader" aria-hidden="true" />
      <span className="shimmer h-3 w-14 rounded-sm" />
    </div>
  );
}

export function SkeletonSheet({
  lines = 3,
  header = true,
}: {
  lines?: number;
  header?: boolean;
}) {
  return (
    <div className="sheet p-4">
      {header && <span className="shimmer h-2.5 w-24 rounded-sm block mb-4" />}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={`${68 - i * 9}%`} />
      ))}
    </div>
  );
}

export function PageSkeleton({ sheets = 2 }: { sheets?: number }) {
  return (
    <div className="space-y-5" role="status" aria-label="Wird geladen">
      <span className="sr-only">Wird geladen…</span>
      {Array.from({ length: sheets }).map((_, i) => (
        <SkeletonSheet key={i} lines={i === 0 ? 2 : 4} />
      ))}
    </div>
  );
}
