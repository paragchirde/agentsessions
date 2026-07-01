"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectGroup, SessionSummary } from "@/lib/sessions";
import {
  buildCommand,
  contextFit,
  type FitVerdict,
  type ModelInfo,
} from "@/lib/models";
import {
  allUserModels,
  findModelForUsage,
  K_CUSTOM,
  K_OVR,
  loadJSON,
  type Override,
} from "@/lib/profile-store";
import { formatCompact } from "@/lib/format";
import { SpikeMark } from "./components/spike-mark";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

function matches(s: SessionSummary, project: ProjectGroup, q: string): boolean {
  if (!q) return true;
  const hay = [
    s.title,
    s.firstPrompt,
    s.lastPrompt,
    s.id,
    s.gitBranch,
    project.projectName,
    project.projectPath,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((term) => hay.includes(term));
}

const FIT_STYLE: Record<FitVerdict, { dot: string; text: string; label: string }> = {
  fits: { dot: "bg-success", text: "text-success", label: "fits context" },
  tight: { dot: "bg-warning", text: "text-warning", label: "tight fit" },
  overflow: { dot: "bg-error", text: "text-error", label: "exceeds window" },
  unknown: { dot: "bg-muted-soft", text: "text-muted-soft", label: "size unknown" },
};

/* Cross-model resume controls: pick a model, see the exact copyable command
   for continuing (or forking) the session on it, with a context-fit guard. */
function ResumeControls({
  session,
  models,
}: {
  session: SessionSummary;
  models: ModelInfo[];
}) {
  const sessionModel = findModelForUsage(models, session.primaryModel) ?? null;
  const [modelId, setModelId] = useState(sessionModel?.id ?? models[0].id);
  const [fork, setFork] = useState(false);
  const [copied, setCopied] = useState(false);

  // Default to the session's own model once it resolves against the merged list
  // (custom profiles load from localStorage after mount).
  useEffect(() => {
    if (sessionModel && !models.some((m) => m.id === modelId)) {
      setModelId(sessionModel.id);
    }
  }, [models, sessionModel, modelId]);

  const model = models.find((m) => m.id === modelId) ?? models[0];
  const command = buildCommand({
    model,
    cwd: session.projectPath,
    sessionId: session.id,
    fork,
  });
  const fit = contextFit(session.contextTokens, model);
  const fitStyle = FIT_STYLE[fit];
  const switching = sessionModel ? model.id !== sessionModel.id : false;

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-muted">Continue on</label>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="rounded-md border border-hairline bg-canvas px-2 py-1 text-[12px] font-medium text-ink focus:border-primary focus:outline-none"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <span
          className={`flex items-center gap-1 text-[11px] ${fitStyle.text}`}
          title={
            session.contextTokens
              ? `thread ≈ ${formatCompact(session.contextTokens)} tokens · ${model.label} window ${formatCompact(model.contextWindow)}`
              : "context size unknown"
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${fitStyle.dot}`} />
          {fitStyle.label}
        </span>

        <label className="ml-auto flex select-none items-center gap-1 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={fork}
            onChange={(e) => setFork(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          fork
        </label>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-surface-dark px-3 py-2">
        <span className="select-none font-mono text-[12px] text-accent-teal">
          ❯
        </span>
        <code className="dark-scroll min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-on-dark">
          {command}
        </code>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard unavailable */
            }
          }}
          className="shrink-0 rounded-md bg-surface-dark-elevated px-2.5 py-1 text-[12px] font-medium text-on-dark transition-colors hover:bg-[#33302b]"
          title={command}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      {switching && fit === "overflow" && (
        <p className="mt-1.5 text-[11px] text-error">
          This thread (~{formatCompact(session.contextTokens)} tokens) is larger
          than {model.label}&rsquo;s {formatCompact(model.contextWindow)} window —
          it likely won&rsquo;t load. Try forking, or a larger-context model.
        </p>
      )}
    </div>
  );
}

function SessionCard({
  session,
  models,
}: {
  session: SessionSummary;
  models: ModelInfo[];
}) {
  const preview = session.lastPrompt ?? session.firstPrompt ?? "";
  const label = modelLabel(session, models);
  return (
    <article className="min-w-0 rounded-xl border border-hairline bg-canvas p-5 transition-colors hover:border-primary-disabled">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-[15px] font-medium leading-snug text-ink">
          {session.title ?? "Untitled session"}
        </h3>
        {session.gitBranch && (
          <span className="shrink-0 rounded-full bg-surface-card px-2.5 py-1 font-mono text-[11px] text-muted">
            ⎇ {session.gitBranch}
          </span>
        )}
      </div>

      {preview && (
        <p className="mt-1.5 line-clamp-2 break-words [overflow-wrap:anywhere] text-[13px] leading-[1.55] text-body">
          {preview}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-soft">
        <span>{relativeTime(session.modifiedAt)}</span>
        <span aria-hidden>·</span>
        <span>{session.messageCount} messages</span>
        {label && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono">{label}</span>
          </>
        )}
        {session.contextTokens > 0 && (
          <>
            <span aria-hidden>·</span>
            <span title="approx. live context size">
              ~{formatCompact(session.contextTokens)} ctx
            </span>
          </>
        )}
      </div>

      <ResumeControls session={session} models={models} />
    </article>
  );
}

// Friendly label for the model that ran most of this session.
function modelLabel(s: SessionSummary, models: ModelInfo[]): string | null {
  if (!s.primaryModel) return null;
  return findModelForUsage(models, s.primaryModel)?.label ?? s.primaryModel;
}

export function Dashboard({ groups }: { groups: ProjectGroup[] }) {
  const [query, setQuery] = useState("");
  const [activeProject, setActiveProject] = useState<string | null>(null);

  // Built-in registry + the user's custom/edited profiles (localStorage),
  // loaded after mount so the switch-model picker matches the Launch page.
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [custom, setCustom] = useState<ModelInfo[]>([]);
  useEffect(() => {
    setOverrides(loadJSON<Record<string, Override>>(K_OVR, {}));
    setCustom(loadJSON<ModelInfo[]>(K_CUSTOM, []));
  }, []);
  const models = useMemo(
    () => allUserModels(overrides, custom),
    [overrides, custom],
  );

  const totalSessions = useMemo(
    () => groups.reduce((n, g) => n + g.sessions.length, 0),
    [groups],
  );

  const filtered = useMemo(() => {
    return groups
      .filter((g) => !activeProject || g.projectPath === activeProject)
      .map((g) => ({
        ...g,
        sessions: g.sessions.filter((s) => matches(s, g, query)),
      }))
      .filter((g) => g.sessions.length > 0);
  }, [groups, query, activeProject]);

  const shownSessions = filtered.reduce((n, g) => n + g.sessions.length, 0);

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[232px_1fr]">
      {/* sidebar — project navigation */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 px-3 text-[12px] font-medium uppercase tracking-[1.5px] text-muted-soft">
          Projects
        </p>
        <nav className="flex flex-col gap-0.5">
          <ProjectNavItem
            label="All projects"
            count={totalSessions}
            active={activeProject === null}
            onClick={() => setActiveProject(null)}
          />
          {groups.map((g) => (
            <ProjectNavItem
              key={g.projectPath}
              label={g.projectName}
              count={g.sessions.length}
              active={activeProject === g.projectPath}
              onClick={() => setActiveProject(g.projectPath)}
            />
          ))}
        </nav>
      </aside>

      {/* main column */}
      <div className="min-w-0">
        <div className="relative mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, prompt, project, or branch…"
            className="h-11 w-full rounded-lg border border-hairline bg-canvas px-4 text-[15px] text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          />
          {query && (
            <p className="mt-2 text-[13px] text-muted">
              {shownSessions} match{shownSessions === 1 ? "" : "es"}
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-surface-card px-6 py-16 text-center">
            <SpikeMark size={20} className="mx-auto mb-3 text-muted-soft" />
            <p className="text-[15px] text-muted">
              No sessions match {query ? `“${query}”` : "this filter"}.
            </p>
          </div>
        ) : (
          <div className="space-y-9">
            {filtered.map((group) => (
              <section key={group.projectPath}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="shrink-0 font-display text-[24px] leading-none text-ink">
                    {group.projectName}
                  </h2>
                  <span className="hidden min-w-0 flex-1 truncate font-mono text-[12px] text-muted-soft sm:block">
                    {group.projectPath}
                  </span>
                  <span className="ml-auto shrink-0 text-[12px] text-muted">
                    {group.sessions.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.sessions.map((s) => (
                    <SessionCard key={s.id} session={s} models={models} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectNavItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-[14px] transition-colors ${
        active
          ? "bg-surface-cream-strong font-medium text-ink"
          : "text-muted hover:bg-surface-soft hover:text-body-strong"
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`ml-2 shrink-0 text-[12px] ${
          active ? "text-muted" : "text-muted-soft"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
