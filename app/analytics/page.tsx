import { getAnalytics } from "@/lib/sessions";
import { formatCompact, formatNumber } from "@/lib/format";
import { SiteNav } from "../components/site-nav";
import {
  DayTimeline,
  MetricBar,
  StackedBar,
  TokenLegend,
} from "./charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const a = await getAnalytics(30);

  const modelGrand = (m: { input: number; output: number; cacheRead: number; cacheWrite: number }) =>
    m.input + m.output + m.cacheRead + m.cacheWrite;
  const maxModel = Math.max(1, ...a.byModel.map(modelGrand));
  const maxTool = Math.max(1, ...a.byTool.map((t) => t.count));
  const maxProject = Math.max(1, ...a.byProject.map((p) => p.total));
  const topModel = a.byModel[0];

  return (
    <div className="min-h-screen bg-canvas">
      <SiteNav active="analytics" />

      <div className="mx-auto max-w-[1200px] px-6 pb-24 pt-10">
        <header className="mb-8">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-card px-3 py-1 text-[12px] font-medium uppercase tracking-[1.5px] text-muted">
            Usage analytics
          </p>
          <h1 className="font-display text-[44px] leading-[1.05] text-ink">
            Where your tokens go.
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-body">
            Aggregated from every assistant turn across {a.totals.sessions}{" "}
            sessions — token volume by model, tool calls, and activity over time.
          </p>
        </header>

        {/* hero stats — one dark tile for the cream→dark rhythm */}
        <section className="mb-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Total tokens"
            value={formatCompact(a.totals.grandTotal)}
            sub={`${formatNumber(a.totals.grandTotal)} incl. cache`}
          />
          <Stat
            label="Output generated"
            value={formatCompact(a.totals.output)}
            sub="tokens written by models"
          />
          <Stat
            label="Tool calls"
            value={formatNumber(a.totals.toolCalls)}
            sub={`${a.byTool.length} distinct tools`}
          />
          <StatDark
            label="Models used"
            value={String(a.totals.models)}
            sub={topModel ? `top: ${topModel.model}` : undefined}
          />
        </section>

        {/* tokens by model */}
        <Panel
          title="Token usage by model"
          aside={<TokenLegend />}
        >
          <div className="divide-y divide-hairline-soft">
            {a.byModel.map((m) => (
              <StackedBar
                key={m.model}
                label={m.model}
                sub={`${formatNumber(m.messages)} msgs`}
                seg={m}
                rowTotal={modelGrand(m)}
                maxTotal={maxModel}
              />
            ))}
          </div>
          {topModel && (
            <p className="mt-4 rounded-lg bg-surface-soft px-4 py-3 text-[13px] leading-[1.55] text-muted">
              <span className="font-medium text-body-strong">Note:</span>{" "}
              models that use prompt caching (the Claude family) show most of
              their volume as <span className="text-accent-amber">cache reads</span>,
              while models without caching re-send the full context as{" "}
              <span className="text-accent-teal">input</span> every turn — which
              is why raw token volume can differ wildly between models doing
              similar work.
            </p>
          )}
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* tool usage */}
          <Panel title="Tool usage">
            <div>
              {a.byTool.slice(0, 12).map((t) => (
                <MetricBar
                  key={t.tool}
                  label={t.tool}
                  value={t.count}
                  fraction={t.count / maxTool}
                />
              ))}
            </div>
          </Panel>

          {/* tokens by project */}
          <Panel title="Tokens by project">
            <div>
              {a.byProject.slice(0, 12).map((p) => (
                <MetricBar
                  key={p.projectPath}
                  label={p.projectName}
                  value={p.total}
                  valueLabel={`${formatCompact(p.total)} · ${p.sessions} sess`}
                  fraction={p.total / maxProject}
                  color="var(--color-accent-teal)"
                />
              ))}
            </div>
          </Panel>
        </div>

        {/* activity timeline */}
        <div className="mt-5">
          <Panel title="Activity — last 30 days" aside={<span className="text-[12px] text-muted-soft">input + output tokens per day</span>}>
            <DayTimeline days={a.byDay} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-xl border border-hairline bg-canvas p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[22px] leading-none text-ink">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card px-6 py-5">
      <div className="font-display text-[34px] leading-none text-ink">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted-soft">{sub}</div>}
    </div>
  );
}

function StatDark({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-surface-dark px-6 py-5">
      <div className="font-display text-[34px] leading-none text-on-dark">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-on-dark-soft">
        {label}
      </div>
      {sub && (
        <div className="mt-0.5 truncate font-mono text-[11px] text-on-dark-soft/70">
          {sub}
        </div>
      )}
    </div>
  );
}
