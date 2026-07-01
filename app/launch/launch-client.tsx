"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCommand,
  PERMISSION_MODES,
  type ModelInfo,
  type Provider,
} from "@/lib/models";
import { formatCompact } from "@/lib/format";

export type DiscoveredDTO = {
  model: ModelInfo;
  source: "anthropic" | "ollama";
  detail?: string;
  isDefault?: boolean;
};
type Source = "anthropic" | "ollama" | "env" | "custom";
type Override = { label?: string; contextWindow?: number; agentCapable?: boolean };
type Merged = {
  model: ModelInfo;
  source: Source;
  detail?: string;
  isDefault?: boolean;
  custom: boolean;
};
type Recent = {
  id: string;
  modelId: string;
  modelLabel: string;
  projectPath: string;
  projectName: string;
  prompt: string;
  permissionMode: string;
  command: string;
  ts: number;
};

const K_OVR = "ccs:profile-overrides";
const K_CUSTOM = "ccs:custom-profiles";
const K_RECENT = "ccs:recent-launches";
const CUSTOM = "__custom_path__";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage unavailable */
  }
}

function relTime(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const selectCls =
  "w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-[14px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15";
const inputCls =
  "w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-[14px] text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15 disabled:opacity-60";

export function LaunchClient({
  discovered,
  projects,
  ollamaRunning,
}: {
  discovered: DiscoveredDTO[];
  projects: { name: string; path: string }[];
  ollamaRunning: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [custom, setCustom] = useState<ModelInfo[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => {
    setOverrides(load<Record<string, Override>>(K_OVR, {}));
    setCustom(load<ModelInfo[]>(K_CUSTOM, []));
    setRecents(load<Recent[]>(K_RECENT, []));
    setMounted(true);
  }, []);

  const merged: Merged[] = useMemo(() => {
    const base: Merged[] = discovered.map((d) => {
      const o = overrides[d.model.id];
      const model: ModelInfo = o
        ? {
            ...d.model,
            ...(o.label ? { label: o.label } : {}),
            ...(o.contextWindow != null ? { contextWindow: o.contextWindow } : {}),
            ...(o.agentCapable != null ? { agentCapable: o.agentCapable } : {}),
          }
        : d.model;
      return {
        model,
        source: d.source,
        detail: d.detail,
        isDefault: d.isDefault,
        custom: false,
      };
    });
    const customs: Merged[] = custom.map((m) => ({
      model: m,
      source: "custom",
      detail: m.provider === "env" ? "Custom · env" : `Custom · ${m.provider}`,
      custom: true,
    }));
    return [...base, ...customs];
  }, [discovered, overrides, custom]);

  const defaultModelId =
    discovered.find((d) => d.isDefault)?.model.id ??
    merged[0]?.model.id ??
    "";

  // ── builder state ───────────────────────────────────────────────
  const [projectChoice, setProjectChoice] = useState(
    projects[0]?.path ?? CUSTOM,
  );
  const [customPath, setCustomPath] = useState("");
  const [modelId, setModelId] = useState(defaultModelId);
  const [permissionMode, setPermissionMode] = useState<string>("default");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  // Keep selection valid as profiles load/change.
  useEffect(() => {
    if (mounted && !merged.some((m) => m.model.id === modelId)) {
      setModelId(defaultModelId);
    }
  }, [mounted, merged, modelId, defaultModelId]);

  const selected = merged.find((m) => m.model.id === modelId) ?? merged[0];
  const cwd = projectChoice === CUSTOM ? customPath : projectChoice;
  const command = selected
    ? buildCommand({
        model: selected.model,
        cwd: cwd || "<project-path>",
        prompt: prompt.trim() || undefined,
        permissionMode,
      })
    : "";

  function doCopy() {
    navigator.clipboard?.writeText(command).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
    if (!selected) return;
    const entry: Recent = {
      id: `${Date.now()}`,
      modelId: selected.model.id,
      modelLabel: selected.model.label,
      projectPath: cwd,
      projectName:
        projects.find((p) => p.path === cwd)?.name || cwd || "(unset)",
      prompt: prompt.trim(),
      permissionMode,
      command,
      ts: Date.now(),
    };
    const next = [entry, ...recents].slice(0, 8);
    setRecents(next);
    persist(K_RECENT, next);
  }

  // ── profile editing ─────────────────────────────────────────────
  const [editor, setEditor] = useState<EditorState | null>(null);

  function saveOverride(id: string, ovr: Override) {
    const next = { ...overrides, [id]: ovr };
    setOverrides(next);
    persist(K_OVR, next);
  }
  function clearOverride(id: string) {
    const next = { ...overrides };
    delete next[id];
    setOverrides(next);
    persist(K_OVR, next);
  }
  function upsertCustom(model: ModelInfo) {
    const next = custom.some((c) => c.id === model.id)
      ? custom.map((c) => (c.id === model.id ? model : c))
      : [...custom, model];
    setCustom(next);
    persist(K_CUSTOM, next);
  }
  function deleteCustom(id: string) {
    const next = custom.filter((c) => c.id !== id);
    setCustom(next);
    persist(K_CUSTOM, next);
  }

  if (!mounted) {
    return <div className="h-64 animate-pulse rounded-xl bg-surface-card" />;
  }

  const ollamaCount = merged.filter((m) => m.source === "ollama").length;

  return (
    <div>
      {/* available models */}
      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[22px] leading-none text-ink">
            Available models
          </h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <span
                className={`h-2 w-2 rounded-full ${ollamaRunning ? "bg-success" : "bg-muted-soft"}`}
              />
              {ollamaRunning
                ? `Ollama running · ${ollamaCount} model${ollamaCount === 1 ? "" : "s"}`
                : "Ollama not detected"}
            </span>
            <button
              onClick={() => setEditor(blankDraft())}
              className="rounded-md border border-hairline bg-canvas px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-soft"
            >
              + Add model
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {merged.map((p) => (
            <ModelCard
              key={p.model.id}
              p={p}
              edited={!!overrides[p.model.id]}
              onEdit={() => setEditor(draftFrom(p))}
              onDelete={p.custom ? () => deleteCustom(p.model.id) : undefined}
              onReset={
                overrides[p.model.id]
                  ? () => clearOverride(p.model.id)
                  : undefined
              }
            />
          ))}
        </div>

        {editor && (
          <ProfileEditor
            state={editor}
            onCancel={() => setEditor(null)}
            onSave={(d) => {
              if (d.isCustom) {
                upsertCustom(draftToModel(d));
              } else {
                saveOverride(d.editingId!, {
                  label: d.label || undefined,
                  contextWindow: d.contextWindow
                    ? Number(d.contextWindow)
                    : undefined,
                  agentCapable: d.agentCapable,
                });
              }
              setEditor(null);
            }}
          />
        )}
      </section>

      {/* builder */}
      <h2 className="mb-3 font-display text-[22px] leading-none text-ink">
        Build a launch command
      </h2>
      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
        <div className="rounded-xl border border-hairline bg-canvas p-6">
          <Field label="Project directory">
            <select
              value={projectChoice}
              onChange={(e) => setProjectChoice(e.target.value)}
              className={selectCls}
            >
              {projects.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.name} — {p.path}
                </option>
              ))}
              <option value={CUSTOM}>Custom path…</option>
            </select>
            {projectChoice === CUSTOM && (
              <input
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="/absolute/path/to/project"
                className={`mt-2 ${inputCls}`}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Model">
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className={selectCls}
              >
                {merged.map((m) => (
                  <option key={m.model.id} value={m.model.id}>
                    {m.model.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Permission mode">
              <select
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value)}
                className={selectCls}
              >
                {PERMISSION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {selected && (
            <p className="-mt-2 mb-5 text-[12px] text-muted-soft">
              {selected.model.contextWindow > 0
                ? `${formatCompact(selected.model.contextWindow)} context window`
                : "context window unknown"}
              {" · "}
              {selected.model.agentCapable ? "agent-capable" : "chat-only"}
            </p>
          )}

          <Field label="First prompt (optional)">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="What do you want to start working on?"
              className={`${inputCls} resize-y`}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-hairline bg-canvas p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-medium text-ink">Your command</h3>
            <button
              onClick={doCopy}
              className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              {copied ? "Copied ✓" : "Copy command"}
            </button>
          </div>
          <div className="rounded-lg bg-surface-dark p-4">
            <code className="dark-scroll block overflow-x-auto whitespace-pre-wrap break-all font-mono text-[13px] leading-[1.6] text-on-dark">
              <span className="select-none text-accent-teal">❯ </span>
              {command}
            </code>
          </div>
          <p className="mt-3 text-[12px] leading-[1.5] text-muted">
            Paste into your terminal to start a fresh session.
            {selected?.source === "ollama" && " Requires Ollama running."}
            {selected?.source === "custom" &&
              selected.model.provider === "env" &&
              " Replace <token> with your key."}
          </p>
        </div>
      </div>

      {/* recent launches */}
      {recents.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[22px] leading-none text-ink">
              Recent launches
            </h2>
            <button
              onClick={() => {
                setRecents([]);
                persist(K_RECENT, []);
              }}
              className="text-[12px] text-muted hover:text-body-strong"
            >
              Clear
            </button>
          </div>
          <div className="divide-y divide-hairline-soft rounded-xl border border-hairline bg-canvas">
            {recents.map((r) => (
              <RecentRow
                key={r.id}
                r={r}
                onUse={() => {
                  setModelId(r.modelId);
                  setPermissionMode(r.permissionMode);
                  setPrompt(r.prompt);
                  if (projects.some((p) => p.path === r.projectPath)) {
                    setProjectChoice(r.projectPath);
                  } else {
                    setProjectChoice(CUSTOM);
                    setCustomPath(r.projectPath);
                  }
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── model card ────────────────────────────────────────────────────
function ModelCard({
  p,
  edited,
  onEdit,
  onDelete,
  onReset,
}: {
  p: Merged;
  edited: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink">{p.model.label}</span>
        <div className="flex shrink-0 items-center gap-1">
          {p.isDefault && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[1px] text-on-primary">
              Default
            </span>
          )}
          {p.custom && (
            <span className="rounded-full bg-accent-teal/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[1px] text-accent-teal">
              Custom
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 font-mono text-[12px] text-muted">
        {p.model.launchModel}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Tag>{p.detail ?? p.source}</Tag>
        <Tag>
          {p.model.contextWindow > 0
            ? `${formatCompact(p.model.contextWindow)} ctx`
            : "ctx unknown"}
        </Tag>
        <Tag tone={p.model.agentCapable ? "ok" : "muted"}>
          {p.model.agentCapable ? "agent" : "chat-only"}
        </Tag>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[12px]">
        <button onClick={onEdit} className="text-muted hover:text-primary">
          Edit
        </button>
        {edited && onReset && (
          <button onClick={onReset} className="text-muted hover:text-primary">
            Reset
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="text-muted hover:text-error">
            Delete
          </button>
        )}
        {edited && !p.custom && (
          <span className="ml-auto text-[11px] text-accent-amber">edited</span>
        )}
      </div>
    </div>
  );
}

// ── profile editor ──────────────────────────────────────────────────
type EditorState = {
  editingId: string | null;
  isCustom: boolean;
  label: string;
  provider: Provider;
  launchModel: string;
  contextWindow: string;
  agentCapable: boolean;
  baseUrl: string;
};

function blankDraft(): EditorState {
  return {
    editingId: null,
    isCustom: true,
    label: "",
    provider: "env",
    launchModel: "",
    contextWindow: "",
    agentCapable: true,
    baseUrl: "",
  };
}
function draftFrom(p: Merged): EditorState {
  return {
    editingId: p.model.id,
    isCustom: p.custom,
    label: p.model.label,
    provider: p.model.provider,
    launchModel: p.model.launchModel,
    contextWindow: p.model.contextWindow ? String(p.model.contextWindow) : "",
    agentCapable: p.model.agentCapable,
    baseUrl: p.model.baseUrl ?? "",
  };
}
function draftToModel(d: EditorState): ModelInfo {
  const id =
    d.editingId ??
    `custom:${d.launchModel.replace(/[^a-z0-9]+/gi, "-")}:${Date.now()}`;
  return {
    id,
    label: d.label || d.launchModel,
    provider: d.provider,
    launchModel: d.launchModel,
    usageIds: [d.launchModel],
    contextWindow: d.contextWindow ? Number(d.contextWindow) : 0,
    agentCapable: d.agentCapable,
    pricing: null,
    baseUrl: d.provider === "env" ? d.baseUrl || undefined : undefined,
  };
}

function ProfileEditor({
  state,
  onCancel,
  onSave,
}: {
  state: EditorState;
  onCancel: () => void;
  onSave: (d: EditorState) => void;
}) {
  const [d, setD] = useState(state);
  const lockIdentity = !d.isCustom; // discovered profiles: only override soft fields
  const valid = d.isCustom ? d.launchModel.trim().length > 0 : true;

  return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-surface-soft p-5">
      <h3 className="mb-4 text-[15px] font-medium text-ink">
        {d.editingId
          ? d.isCustom
            ? "Edit custom model"
            : `Override “${d.label}”`
          : "Add a model"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Label">
          <input
            value={d.label}
            onChange={(e) => setD({ ...d, label: e.target.value })}
            placeholder="My model"
            className={inputCls}
          />
        </Field>
        <Field label="Provider">
          <select
            value={d.provider}
            disabled={lockIdentity}
            onChange={(e) =>
              setD({ ...d, provider: e.target.value as Provider })
            }
            className={selectCls}
          >
            <option value="anthropic">anthropic (native)</option>
            <option value="ollama">ollama</option>
            <option value="env">env (LiteLLM / router / OpenRouter)</option>
          </select>
        </Field>
        <Field label="Model id (--model value)">
          <input
            value={d.launchModel}
            disabled={lockIdentity}
            onChange={(e) => setD({ ...d, launchModel: e.target.value })}
            placeholder="e.g. llama3.1:70b"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Context window (tokens)">
          <input
            value={d.contextWindow}
            inputMode="numeric"
            onChange={(e) =>
              setD({ ...d, contextWindow: e.target.value.replace(/\D/g, "") })
            }
            placeholder="e.g. 131072"
            className={inputCls}
          />
        </Field>
        {d.isCustom && d.provider === "env" && (
          <Field label="Base URL">
            <input
              value={d.baseUrl}
              onChange={(e) => setD({ ...d, baseUrl: e.target.value })}
              placeholder="http://localhost:4000"
              className={`${inputCls} font-mono`}
            />
          </Field>
        )}
        <Field label="Capability">
          <label className="flex h-[42px] items-center gap-2 text-[14px] text-body">
            <input
              type="checkbox"
              checked={d.agentCapable}
              onChange={(e) => setD({ ...d, agentCapable: e.target.checked })}
              className="accent-[var(--color-primary)]"
            />
            Agent-capable (does Anthropic-format tool calls)
          </label>
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          disabled={!valid}
          onClick={() => onSave(d)}
          className="rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-hairline bg-canvas px-4 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-soft"
        >
          Cancel
        </button>
        {lockIdentity && (
          <span className="text-[11px] text-muted-soft">
            Provider & model id are fixed for discovered models — overrides save
            label, context & capability.
          </span>
        )}
      </div>
    </div>
  );
}

function RecentRow({ r, onUse }: { r: Recent; onUse: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-medium text-ink">{r.modelLabel}</span>
          <span className="text-muted-soft">·</span>
          <span className="truncate text-muted">{r.projectName}</span>
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted-soft">
          {r.prompt || "(no initial prompt)"} · {relTime(r.ts)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onUse}
          className="rounded-md border border-hairline bg-canvas px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-surface-soft"
        >
          Use
        </button>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(r.command).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => {},
            );
          }}
          className="rounded-md bg-surface-card px-2.5 py-1 text-[12px] font-medium text-body-strong hover:bg-surface-cream-strong"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Tag({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "ok" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "bg-accent-teal/15 text-accent-teal"
      : tone === "muted"
        ? "bg-surface-cream-strong text-muted-soft"
        : "bg-surface-cream-strong text-muted";
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <label className="mb-1.5 block text-[13px] font-medium text-body-strong">
        {label}
      </label>
      {children}
    </div>
  );
}
