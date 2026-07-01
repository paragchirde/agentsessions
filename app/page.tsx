import { listProjectGroups } from "@/lib/sessions";
import { SpikeMark } from "./components/spike-mark";
import { SiteNav } from "./components/site-nav";
import { Dashboard } from "./dashboard";

export const dynamic = "force-dynamic";

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.round(day / 30)}mo ago`;
}

export default async function Home() {
  const groups = await listProjectGroups();
  const totalSessions = groups.reduce((n, g) => n + g.sessions.length, 0);
  const totalMessages = groups.reduce(
    (n, g) => n + g.sessions.reduce((m, s) => m + s.messageCount, 0),
    0,
  );
  const lastActivity = groups.length ? groups[0].lastActivity : 0;
  const topProject = groups[0];

  return (
    <div className="min-h-screen bg-canvas">
      <SiteNav active="sessions" />

      <div className="mx-auto max-w-[1200px] px-6 pb-24 pt-10">

        {/* stat tiles — three cream, one dark for the cream→dark rhythm */}
        <section className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Sessions" value={String(totalSessions)} />
          <StatTile label="Projects" value={String(groups.length)} />
          <StatTile
            label="Messages exchanged"
            value={totalMessages.toLocaleString()}
          />
          <StatTileDark
            label="Most active project"
            value={topProject?.projectName ?? "—"}
            sub={
              lastActivity
                ? `last active ${formatRelative(lastActivity)}`
                : undefined
            }
          />
        </section>

        <Dashboard groups={groups} />
      </div>

      {/* footer — dark navy, never inverts */}
      <footer className="bg-surface-dark">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-on-dark">
            <SpikeMark size={16} className="text-on-dark" />
            <span className="font-display text-[16px]">
              AgentSessions{" "}
              <span className="text-on-dark-soft">· for Claude Code</span>
            </span>
          </div>
          <p className="text-[13px] text-on-dark-soft">
            Reads <code className="font-mono">~/.claude/projects</code> · nothing
            leaves your machine
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card px-6 py-5">
      <div className="font-display text-[36px] leading-none text-ink">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-muted">{label}</div>
    </div>
  );
}

function StatTileDark({
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
      <div className="truncate font-display text-[26px] leading-tight text-on-dark">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-on-dark-soft">
        {label}
      </div>
      {sub && (
        <div className="mt-0.5 text-[12px] text-on-dark-soft/70">{sub}</div>
      )}
    </div>
  );
}
