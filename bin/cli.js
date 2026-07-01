#!/usr/bin/env node
"use strict";

// Launcher for `npx agentsessions`: boots the pre-built standalone Next server
// bound to localhost, then opens the browser once it's responding.

const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

if (args.includes("-h") || args.includes("--help")) {
  console.log(`
  agentsessions — browse & resume your Claude Code sessions

  Usage: npx agentsessions [--port <n>] [--no-open]

  Options:
    --port <n>   Port to listen on (default 4317)
    --no-open    Don't open the browser automatically
`);
  process.exit(0);
}

const port = flag("--port", process.env.PORT || "4317");
const host = "127.0.0.1"; // localhost only — the tool reads local files, nothing is exposed
const standaloneDir = path.join(__dirname, "..", ".next", "standalone");
const serverPath = path.join(standaloneDir, "server.js");
const url = `http://${host}:${port}`;

const server = spawn(process.execPath, [serverPath], {
  cwd: standaloneDir,
  env: { ...process.env, PORT: String(port), HOSTNAME: host },
  stdio: "inherit",
});
server.on("exit", (code) => process.exit(code ?? 0));

process.on("SIGINT", () => server.kill("SIGINT"));
process.on("SIGTERM", () => server.kill("SIGTERM"));

console.log(`\n  AgentSessions → ${url}\n  Press Ctrl+C to stop.\n`);

// Poll until the server responds, then open the browser once.
if (!args.includes("--no-open")) {
  const startedAt = Date.now();
  const poll = () => {
    http
      .get(url, () => openBrowser(url))
      .on("error", () => {
        if (Date.now() - startedAt < 15000) setTimeout(poll, 400);
      });
  };
  setTimeout(poll, 600);
}

function openBrowser(target) {
  const p = process.platform;
  try {
    if (p === "darwin") spawn("open", [target], { stdio: "ignore", detached: true }).unref();
    else if (p === "win32")
      spawn("cmd", ["/c", "start", "", target], { stdio: "ignore", detached: true }).unref();
    else spawn("xdg-open", [target], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* opening the browser is best-effort */
  }
}
