import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Claude Code stores every session as a JSONL file at:
//   ~/.claude/projects/<encoded-project-path>/<session-uuid>.jsonl
// The directory name is the absolute project path with "/" -> "-".
const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

// Token counts as recorded in each assistant message's `usage` block.
export type TokenStats = {
  input: number;
  output: number;
  cacheRead: number; // tokens read from prompt cache (cheap)
  cacheWrite: number; // tokens written to prompt cache
};

// Per-model rollup within a session.
export type ModelStats = TokenStats & { messages: number };

export type SessionSummary = {
  id: string; // session UUID (filename without .jsonl)
  projectPath: string; // real cwd of the project
  projectDirKey: string; // encoded directory name on disk
  projectName: string; // last path segment, for display
  title: string | null; // AI-generated session title, if any
  firstPrompt: string | null; // the opening user prompt
  lastPrompt: string | null; // the most recent user prompt
  messageCount: number; // user + assistant turns
  gitBranch: string | null;
  version: string | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  modifiedAt: number; // file mtime (ms) — reliable recency sort key
  sizeBytes: number;
  tokens: TokenStats; // summed across all assistant turns
  models: Record<string, ModelStats>; // per-model breakdown
  tools: Record<string, number>; // tool name -> call count
  toolCalls: number; // total tool_use blocks
  contextTokens: number; // last assistant turn's input+cacheRead ≈ live thread size
  primaryModel: string | null; // model with the most turns in this session
};

export type ProjectGroup = {
  projectPath: string;
  projectName: string;
  projectDirKey: string;
  sessions: SessionSummary[];
  lastActivity: number; // max modifiedAt across its sessions
};

// Pull plain text out of a message `content`, which is either a string or
// an array of content blocks ({type:"text", text})...
function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .filter((b) => b && typeof b === "object" && (b as any).type === "text")
      .map((b) => (b as any).text)
      .filter((t) => typeof t === "string");
    if (parts.length) return parts.join("\n");
  }
  return null;
}

// Claude Code injects a lot of non-human text into user turns: IDE context
// (<ide_selection>, <ide_opened_file>), slash-command stubs, local-command
// wrappers, system reminders, and ─── divider rules. Strip all of that so the
// preview we show is what the person actually typed.
function cleanPromptText(text: string): string {
  let t = text;
  // Drop whole wrapper blocks (and their self-closing/standalone variants).
  t = t.replace(/<ide_[^>]*>[\s\S]*?<\/ide_[^>]*>/g, " ");
  t = t.replace(/<command-[^>]*>[\s\S]*?<\/command-[^>]*>/g, " ");
  t = t.replace(/<command-[^>]*>/g, " ");
  t = t.replace(/<local-command[^>]*>[\s\S]*?<\/local-command[^>]*>/g, " ");
  t = t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, " ");
  t = t.replace(/<[^>]+>/g, " "); // any stray tags
  t = t.replace(/[─━—-]{5,}/g, " "); // divider rules
  return t.replace(/\s+/g, " ").trim();
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function decodeDirKey(dirKey: string): string {
  // Best-effort fallback when no cwd is recorded: "-Users-foo-bar" -> "/Users/foo/bar".
  // Lossy (real "-" in names can't be recovered) so we prefer the cwd field.
  return dirKey.replace(/-/g, "/");
}

async function parseSessionFile(
  dirKey: string,
  filePath: string,
): Promise<SessionSummary | null> {
  const stat = await fs.stat(filePath);
  const id = path.basename(filePath, ".jsonl");

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }

  let title: string | null = null;
  let firstPrompt: string | null = null;
  let lastPrompt: string | null = null;
  let lastPromptField: string | null = null;
  let cwd: string | null = null;
  let gitBranch: string | null = null;
  let version: string | null = null;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;
  let messageCount = 0;
  const tokens: TokenStats = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const models: Record<string, ModelStats> = {};
  const tools: Record<string, number> = {};
  let toolCalls = 0;
  let contextTokens = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }

    const type = o.type;

    if (type === "ai-title" && typeof o.aiTitle === "string") {
      title = o.aiTitle;
      continue;
    }
    if (type === "last-prompt" && typeof o.lastPrompt === "string") {
      lastPromptField = cleanPromptText(o.lastPrompt) || null;
      continue;
    }

    if (type === "user" || type === "assistant") {
      if (o.isSidechain) continue; // subagent traffic, not the main thread
      messageCount++;

      if (typeof o.cwd === "string" && !cwd) cwd = o.cwd;
      if (typeof o.gitBranch === "string" && o.gitBranch) gitBranch = o.gitBranch;
      if (typeof o.version === "string") version = o.version;
      if (typeof o.timestamp === "string") {
        if (!firstTimestamp) firstTimestamp = o.timestamp;
        lastTimestamp = o.timestamp;
      }

      if (type === "user") {
        const raw = extractText(o.message?.content);
        const text = raw ? cleanPromptText(raw) : "";
        if (text) {
          if (!firstPrompt) firstPrompt = text;
          lastPrompt = text;
        }
      }

      if (type === "assistant" && o.message && typeof o.message === "object") {
        const msg = o.message as any;
        const u = msg.usage;
        const model = typeof msg.model === "string" ? msg.model : null;

        if (u && typeof u === "object") {
          const inp = num(u.input_tokens);
          const out = num(u.output_tokens);
          const cr = num(u.cache_read_input_tokens);
          const cw = num(u.cache_creation_input_tokens);
          tokens.input += inp;
          tokens.output += out;
          tokens.cacheRead += cr;
          tokens.cacheWrite += cw;
          // The most recent turn's prompt size (input + cache read) is the best
          // estimate of how large the conversation context currently is.
          if (inp + cr > 0) contextTokens = inp + cr;

          // Skip synthetic/no-model bookkeeping turns in the per-model rollup.
          if (model && model !== "<synthetic>") {
            const m =
              models[model] ??
              (models[model] = {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                messages: 0,
              });
            m.input += inp;
            m.output += out;
            m.cacheRead += cr;
            m.cacheWrite += cw;
            m.messages += 1;
          }
        }

        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block && typeof block === "object" && block.type === "tool_use") {
              const name =
                typeof block.name === "string" ? block.name : "unknown";
              tools[name] = (tools[name] ?? 0) + 1;
              toolCalls++;
            }
          }
        }
      }
    }
  }

  // A file with zero real turns is an empty/aborted session — skip it.
  if (messageCount === 0 && !firstPrompt && !title) return null;

  const projectPath = cwd ?? decodeDirKey(dirKey);

  // The model that did the most turns is the session's "primary" model.
  let primaryModel: string | null = null;
  let topMessages = 0;
  for (const [model, ms] of Object.entries(models)) {
    if (ms.messages > topMessages) {
      topMessages = ms.messages;
      primaryModel = model;
    }
  }

  return {
    id,
    projectPath,
    projectDirKey: dirKey,
    projectName: path.basename(projectPath) || projectPath,
    title,
    firstPrompt,
    lastPrompt: lastPromptField ?? lastPrompt,
    messageCount,
    gitBranch,
    version,
    firstTimestamp,
    lastTimestamp,
    modifiedAt: stat.mtimeMs,
    sizeBytes: stat.size,
    tokens,
    models,
    tools,
    toolCalls,
    contextTokens,
    primaryModel,
  };
}

export async function listSessions(): Promise<SessionSummary[]> {
  let dirs: string[];
  try {
    dirs = await fs.readdir(PROJECTS_DIR);
  } catch {
    return []; // ~/.claude/projects doesn't exist yet
  }

  const summaries: SessionSummary[] = [];

  await Promise.all(
    dirs.map(async (dirKey) => {
      const dirPath = path.join(PROJECTS_DIR, dirKey);
      let entries: string[];
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) return;
        entries = await fs.readdir(dirPath);
      } catch {
        return;
      }

      const files = entries.filter((f) => f.endsWith(".jsonl"));
      const parsed = await Promise.all(
        files.map((f) =>
          parseSessionFile(dirKey, path.join(dirPath, f)).catch(() => null),
        ),
      );
      for (const s of parsed) if (s) summaries.push(s);
    }),
  );

  summaries.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return summaries;
}

export async function listProjectGroups(): Promise<ProjectGroup[]> {
  const sessions = await listSessions();
  const byProject = new Map<string, ProjectGroup>();

  for (const s of sessions) {
    let group = byProject.get(s.projectPath);
    if (!group) {
      group = {
        projectPath: s.projectPath,
        projectName: s.projectName,
        projectDirKey: s.projectDirKey,
        sessions: [],
        lastActivity: 0,
      };
      byProject.set(s.projectPath, group);
    }
    group.sessions.push(s);
    group.lastActivity = Math.max(group.lastActivity, s.modifiedAt);
  }

  const groups = [...byProject.values()];
  groups.sort((a, b) => b.lastActivity - a.lastActivity);
  return groups;
}

// The exact command to resume a session in its own project directory.
export function resumeCommand(s: SessionSummary): string {
  return `cd ${JSON.stringify(s.projectPath)} && claude --resume ${s.id}`;
}

// ── Analytics ────────────────────────────────────────────────────────────

export type ModelBreakdown = ModelStats & { model: string; total: number };
export type ToolBreakdown = { tool: string; count: number };
export type ProjectBreakdown = {
  projectName: string;
  projectPath: string;
  sessions: number;
  tokens: TokenStats;
  total: number; // input + output (billable-ish volume, excludes cache reads)
  toolCalls: number;
};
export type DayBucket = {
  date: string; // YYYY-MM-DD (local)
  total: number; // input + output tokens that day
  sessions: number;
};

export type Analytics = {
  totals: TokenStats & {
    sessions: number;
    messages: number;
    toolCalls: number;
    models: number;
    grandTotal: number; // every token, cache included
  };
  byModel: ModelBreakdown[];
  byTool: ToolBreakdown[];
  byProject: ProjectBreakdown[];
  byDay: DayBucket[];
};

function addTokens(into: TokenStats, from: TokenStats) {
  into.input += from.input;
  into.output += from.output;
  into.cacheRead += from.cacheRead;
  into.cacheWrite += from.cacheWrite;
}

function localDay(iso: string): string {
  // Group by local calendar day for the activity timeline.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getAnalytics(days = 30): Promise<Analytics> {
  const sessions = await listSessions();

  const totals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    sessions: sessions.length,
    messages: 0,
    toolCalls: 0,
    models: 0,
    grandTotal: 0,
  };

  const modelMap = new Map<string, ModelStats>();
  const toolMap = new Map<string, number>();
  const projectMap = new Map<string, ProjectBreakdown>();
  const dayMap = new Map<string, DayBucket>();

  for (const s of sessions) {
    addTokens(totals, s.tokens);
    totals.messages += s.messageCount;
    totals.toolCalls += s.toolCalls;

    for (const [model, ms] of Object.entries(s.models)) {
      const acc =
        modelMap.get(model) ??
        modelMap
          .set(model, {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            messages: 0,
          })
          .get(model)!;
      addTokens(acc, ms);
      acc.messages += ms.messages;
    }

    for (const [tool, count] of Object.entries(s.tools)) {
      toolMap.set(tool, (toolMap.get(tool) ?? 0) + count);
    }

    const pkey = s.projectPath;
    const proj =
      projectMap.get(pkey) ??
      projectMap
        .set(pkey, {
          projectName: s.projectName,
          projectPath: s.projectPath,
          sessions: 0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          total: 0,
          toolCalls: 0,
        })
        .get(pkey)!;
    proj.sessions += 1;
    addTokens(proj.tokens, s.tokens);
    proj.total += s.tokens.input + s.tokens.output;
    proj.toolCalls += s.toolCalls;

    // Attribute the session's billable tokens to its last-active day.
    const dayKey = s.lastTimestamp
      ? localDay(s.lastTimestamp)
      : localDay(new Date(s.modifiedAt).toISOString());
    if (dayKey) {
      const bucket =
        dayMap.get(dayKey) ??
        dayMap.set(dayKey, { date: dayKey, total: 0, sessions: 0 }).get(dayKey)!;
      bucket.total += s.tokens.input + s.tokens.output;
      bucket.sessions += 1;
    }
  }

  totals.grandTotal =
    totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  totals.models = modelMap.size;

  const byModel: ModelBreakdown[] = [...modelMap.entries()]
    .map(([model, ms]) => ({ model, ...ms, total: ms.input + ms.output }))
    .sort((a, b) => b.total - a.total);

  const byTool: ToolBreakdown[] = [...toolMap.entries()]
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);

  const byProject: ProjectBreakdown[] = [...projectMap.values()].sort(
    (a, b) => b.total - a.total,
  );

  // Build a continuous day series for the last `days` days so gaps render as
  // empty bars rather than collapsing the timeline.
  const byDay: DayBucket[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDay(d.toISOString());
    byDay.push(dayMap.get(key) ?? { date: key, total: 0, sessions: 0 });
  }

  return { totals, byModel, byTool, byProject, byDay };
}
