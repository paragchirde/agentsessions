// Model registry — the backbone of cross-model intelligence.
//
// Each entry describes a model backend Claude Code can run against and how to
// build a launch/resume command for it. This is intentionally a plain data
// table so it can later become user-editable config (~/.claude-code-studio).
// Client-safe: no node imports.

export type Provider = "anthropic" | "ollama" | "env";

// USD per 1,000,000 tokens. Estimates — meant to be user-editable. null = unknown.
export type ModelPricing = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export type ModelInfo = {
  id: string; // stable key
  label: string; // friendly display name
  provider: Provider;
  launchModel: string; // value passed to `--model`
  usageIds: string[]; // model strings as they appear in session usage blocks
  contextWindow: number; // tokens — used for the resume context-fit guard
  agentCapable: boolean; // does it reliably do Anthropic-format tool calls?
  pricing: ModelPricing | null; // estimates, editable; null = unknown
  baseUrl?: string; // for env-based backends (LiteLLM / router / OpenRouter)
  note?: string;
};

// Valid values for `claude --permission-mode`. "default" => omit the flag.
export const PERMISSION_MODES = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

// Seeded to match common setups (and this machine: opus default + Ollama
// deepseek-v4-pro:cloud + qwen2.5-coder). Pricing left null until confirmed —
// we don't show dollar costs we can't stand behind.
export const MODELS: ModelInfo[] = [
  {
    id: "opus-1m",
    label: "Opus 4.8 (1M)",
    provider: "anthropic",
    launchModel: "opus[1m]",
    usageIds: ["claude-opus-4-8", "claude-opus-4-8[1m]"],
    contextWindow: 1_000_000,
    agentCapable: true,
    pricing: null,
    note: "Frontier reasoning — best for the hard 10%.",
  },
  {
    id: "sonnet",
    label: "Sonnet 4.6",
    provider: "anthropic",
    launchModel: "sonnet",
    usageIds: ["claude-sonnet-4-6", "claude-sonnet-4-6[1m]"],
    contextWindow: 200_000,
    agentCapable: true,
    pricing: null,
    note: "Balanced default for most agent work.",
  },
  {
    id: "haiku",
    label: "Haiku 4.5",
    provider: "anthropic",
    launchModel: "haiku",
    usageIds: ["claude-haiku-4-5-20251001", "claude-haiku-4-5"],
    contextWindow: 200_000,
    agentCapable: true,
    pricing: null,
    note: "Fast & cheap for simple edits.",
  },
  {
    id: "deepseek-v4-pro-cloud",
    label: "DeepSeek V4 Pro (cloud)",
    provider: "ollama",
    launchModel: "deepseek-v4-pro:cloud",
    usageIds: ["deepseek-v4-pro", "deepseek-v4-pro:cloud"],
    contextWindow: 131_072,
    agentCapable: true,
    pricing: null,
    note: "Via Ollama Cloud. No prompt caching → re-sends context each turn.",
  },
  {
    id: "qwen2.5-coder-7b",
    label: "Qwen2.5 Coder 7B (local)",
    provider: "ollama",
    launchModel: "qwen2.5-coder:7b",
    usageIds: ["qwen2.5-coder:7b", "qwen2.5-coder"],
    contextWindow: 32_768,
    agentCapable: true,
    pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, // local = free
    note: "Runs on your machine — free, but small context window.",
  },
];

export function findModel(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

// Map a usage-block model string (e.g. "claude-opus-4-8") to a registry entry.
export function modelForUsageId(usageModel: string): ModelInfo | undefined {
  return MODELS.find((m) => m.usageIds.includes(usageModel));
}

// Build the copyable shell command to launch/resume in a project on a model.
export function buildCommand(opts: {
  model: ModelInfo;
  cwd: string;
  sessionId?: string; // omit for a brand-new session
  fork?: boolean; // branch to a new session id (keeps the original intact)
  prompt?: string; // optional initial prompt for new sessions
  permissionMode?: string; // omit or "default" => no flag
}): string {
  const { model, cwd, sessionId, fork, prompt, permissionMode } = opts;
  const cd = `cd ${JSON.stringify(cwd)}`;

  // Flags interpreted by the claude CLI itself (regardless of how it's launched).
  const claudeFlags: string[] = [];
  if (sessionId) claudeFlags.push(`--resume ${sessionId}`);
  if (fork && sessionId) claudeFlags.push("--fork-session");
  if (permissionMode && permissionMode !== "default") {
    claudeFlags.push(`--permission-mode ${permissionMode}`);
  }
  if (prompt && !sessionId) claudeFlags.push(JSON.stringify(prompt));

  switch (model.provider) {
    case "ollama": {
      // `ollama launch claude --model X` selects the model via Ollama; flags
      // meant for the claude CLI must come AFTER a `--` separator, otherwise
      // `ollama launch` tries to parse them and errors.
      const base = `ollama launch claude --model ${model.launchModel}`;
      const tail = claudeFlags.length ? ` -- ${claudeFlags.join(" ")}` : "";
      return `${cd} && ${base}${tail}`;
    }
    case "env": {
      // Generic backend (LiteLLM / router / OpenRouter). Base URL is filled in
      // if the profile defines one; the token stays a placeholder — Studio
      // never stores secrets.
      const baseUrl = model.baseUrl?.trim() || "<base-url>";
      const flags = [`--model ${model.launchModel}`, ...claudeFlags].join(" ");
      return `${cd} && ANTHROPIC_BASE_URL=${baseUrl} ANTHROPIC_AUTH_TOKEN=<token> claude ${flags}`;
    }
    case "anthropic":
    default: {
      const flags = [`--model ${model.launchModel}`, ...claudeFlags].join(" ");
      return `${cd} && claude ${flags}`;
    }
  }
}

// Does this session's live context fit a target model's window?
export type FitVerdict = "fits" | "tight" | "overflow" | "unknown";

export function contextFit(
  contextTokens: number,
  model: ModelInfo,
): FitVerdict {
  if (!contextTokens) return "unknown";
  if (contextTokens > model.contextWindow) return "overflow";
  if (contextTokens > model.contextWindow * 0.8) return "tight";
  return "fits";
}
