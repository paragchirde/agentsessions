# AgentSessions

A local studio to **browse, resume, and switch models** on your [Claude Code](https://claude.com/claude-code) sessions — with usage analytics and one-command launch. Runs entirely on your machine; nothing leaves it.

> Claude Code already saves every session to `~/.claude/projects/`, but once you close the terminal it's hard to find which project a conversation lived in. AgentSessions gives you one searchable, cross-project view — and lets you continue any session on a different model (Anthropic, Ollama, or your own backend).

## Run it

```bash
npx @paragchirde/agentsessions
```

That's it — it starts a local server and opens your browser. Requires **Node ≥ 18.18**. (Ollama is optional — if it's running, its models are auto-detected.)

Prefer a short command? Install once, then run `agentsessions`:

```bash
npm install -g @paragchirde/agentsessions
agentsessions
```

Options:

```bash
agentsessions --port 4317   # choose a port (default 4317)
agentsessions --no-open     # don't auto-open the browser
```

## What it does

- **Sessions** — every Claude Code session across all projects, searchable, grouped by project. Each card shows the model, live context size, and a one-click command to **continue on any model** (with a context-fit guard) or fork.
- **Launch** — auto-discovers your model backends (native Claude, Ollama local/cloud, or custom env-based like LiteLLM/OpenRouter). Compose a new-session command with a project, model, permission mode, and first prompt. Add and tune your own model profiles.
- **Analytics** — token volume by model, tool-call counts, tokens by project, and a 30-day activity timeline.

Light and dark themes included.

## How it works

AgentSessions reads the JSONL session logs Claude Code writes to `~/.claude/projects/` and, for launching, generates copyable shell commands — it never executes anything or handles your credentials. Custom model profiles are stored locally in your browser.

## Develop

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
npm run dev        # http://localhost:3000
npm run package    # production build + standalone bundle (what gets published)
```

## License

MIT © Parag Chirde
