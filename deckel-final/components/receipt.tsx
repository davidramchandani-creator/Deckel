import type { ReactNode } from "react";

/** A row on the bill: label on the left, dotted leader, figure on the right. */
export function Line({
  left,
  right,
  sub,
  emphasis = false,
}: {
  left: ReactNode;
  right: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "py-1.5" : "py-1"}>
      <div className="flex items-baseline">
        <span className={emphasis ? "font-medium" : undefined}>{left}</span>
        <span className="leader" aria-hidden="true" />
        <span className={`num ${emphasis ? "font-medium" : ""}`}>{right}</span>
      </div>
      {sub && <div className="text-xs text-ink-soft mt-0.5">{sub}</div>}
    </div>
  );
}

export function Sheet({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`sheet p-4 ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="label mb-2">{children}</h2>;
}

/** Swiss formatting: CHF 12.50 */
export function money(amount: number, currency = "CHF") {
  return `${currency} ${amount.toFixed(2)}`;
}

export function points(value: number) {
  return `${value.toFixed(1)} P`;
}
