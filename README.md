# Claude Code Studio

A local UI to browse and resume your Claude Code sessions across **all** projects.

Claude Code already persists every session to `~/.claude/projects/<project>/<session-id>.jsonl`,
and `claude --resume` can reopen them — but only for the folder you're currently in. Once you
close a terminal it's hard to remember which project a conversation lived in. This gives you one
searchable, cross-project view of every session, with a one-click command to resume each one.

## What it does (MVP)

- Reads `~/.claude/projects/` and parses every session file
- Groups sessions by project, most-recently-active first
- Shows each session's AI title, latest prompt, message count, git branch, and age
- Full-text search across titles, prompts, project paths, and branches
- **Copy resume cmd** → `cd "<project>" && claude --resume <session-id>`

## Run it

Requires Node ≥ 18.18 (the repo pins Node 22 via `.nvmrc`).

```bash
nvm use            # or: nvm use 22
npm install
npm run dev        # http://localhost:3000
```

## How it works

- `lib/sessions.ts` — the parser. Walks the projects dir, reads each JSONL file,
  and extracts session metadata (real `cwd`, `ai-title`, first/last human prompt
  with IDE/command noise stripped, timestamps, branch).
- `app/api/sessions/route.ts` — serves the parsed groups as JSON.
- `app/page.tsx` + `app/session-browser.tsx` — server-rendered list with a
  client-side search/copy layer.

## Deliberately not built yet

- Auto-starting a daemon on session start — unnecessary; the data is just files on disk.
- Launching `claude --resume` directly from the UI (needs an embedded terminal) —
  copying the command covers the need for now.
