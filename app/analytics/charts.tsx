import { formatCompact, formatNumber, pct } from "@/lib/format";

// Token-type color legend — coral for the generated output (the valuable
// part), teal/amber/neutral for the rest.
export const TOKEN_COLORS = {
  output: "var(--color-primary)",
  input: "var(--color-accent-teal)",
  cacheRead: "var(--color-accent-amber)",
  cacheWrite: "var(--color-muted-soft)",
} as const;

const TOKEN_LABELS: Record<keyof typeof TOKEN_COLORS, string> = {
  output: "Output",
  input: "Input",
  cacheRead: "Cache read",
  cacheWrite: "Cache write",
};

export function TokenLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {(Object.keys(TOKEN_COLORS) as (keyof typeof TOKEN_COLORS)[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[12px] text-muted">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: TOKEN_COLORS[k] }}
          />
          {TOKEN_LABELS[k]}
        </span>
      ))}
    </div>
  );
}

type Seg = { input: number; output: number; cacheRead: number; cacheWrite: number };

/* A horizontal stacked bar: full bar width is this row's share of the max row
   total; segments show the token-type composition within it. */
export function StackedBar({
  label,
  sub,
  seg,
  rowTotal,
  maxTotal,
}: {
  label: string;
  sub?: string;
  seg: Seg;
  rowTotal: number;
  maxTotal: number;
}) {
  const barWidth = Math.max(pct(rowTotal, maxTotal), 1.5); // keep tiny rows visible
  const order: (keyof typeof TOKEN_COLORS)[] = [
    "output",
    "input",
    "cacheRead",
    "cacheWrite",
  ];
  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="truncate font-mono text-[13px] text-body-strong">
          {label}
        </span>
        <span className="shrink-0 text-[13px] font-medium text-ink">
          {formatCompact(rowTotal)}
          {sub && <span className="ml-2 text-[12px] text-muted-soft">{sub}</span>}
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-card"
        style={{ width: `${barWidth}%` }}
        title={order
          .map((k) => `${TOKEN_LABELS[k]}: ${formatNumber(seg[k])}`)
          .join("  ·  ")}
      >
        {order.map((k) =>
          seg[k] > 0 ? (
            <span
              key={k}
              style={{
                width: `${pct(seg[k], rowTotal)}%`,
                background: TOKEN_COLORS[k],
              }}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

/* Vertical bar timeline of daily token volume. */
export function DayTimeline({
  days,
}: {
  days: { date: string; total: number; sessions: number }[];
}) {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="flex h-40 items-end gap-[3px]">
      {days.map((d) => {
        const h = d.total > 0 ? Math.max((d.total / max) * 100, 3) : 0;
        const [, m, day] = d.date.split("-");
        return (
          <div
            key={d.date}
            className="group flex h-full flex-1 flex-col justify-end"
            title={`${d.date} · ${formatCompact(d.total)} tokens · ${d.sessions} session${d.sessions === 1 ? "" : "s"}`}
          >
            <span
              className="w-full rounded-t-[3px] bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${h}%` }}
            />
            {Number(day) === 1 || day === "15" ? (
              <span className="mt-1 text-center text-[9px] text-muted-soft">
                {m}/{day}
              </span>
            ) : (
              <span className="mt-1 text-center text-[9px] text-transparent">
                ·
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* A simple labelled bar for counts (tools, projects). */
export function MetricBar({
  label,
  value,
  valueLabel,
  fraction,
  color = "var(--color-primary)",
}: {
  label: string;
  value: number;
  valueLabel?: string;
  fraction: number; // 0..1 of the max
  color?: string;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] text-body-strong">{label}</span>
        <span className="shrink-0 font-mono text-[13px] text-ink">
          {valueLabel ?? formatNumber(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-card">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.max(fraction * 100, 1.5)}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
