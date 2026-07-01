import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { MODELS, type ModelInfo } from "./models";

// Live discovery of the model backends actually available on this machine:
// Anthropic-native models, plus whatever Ollama is currently serving.

export type ProfileSource = "anthropic" | "ollama";

export type DiscoveredProfile = {
  model: ModelInfo;
  source: ProfileSource;
  available: boolean;
  detail?: string; // e.g. "4.7 GB local" / "Ollama Cloud" / "Anthropic"
  isDefault?: boolean; // matches the native default in settings.json
};

export type Discovery = {
  profiles: DiscoveredProfile[];
  ollamaRunning: boolean;
  nativeDefaultModel: string | null;
};

async function readNativeDefault(): Promise<string | null> {
  try {
    const raw = await fs.readFile(
      path.join(os.homedir(), ".claude", "settings.json"),
      "utf8",
    );
    const j = JSON.parse(raw);
    return typeof j.model === "string" ? j.model : null;
  } catch {
    return null;
  }
}

type OllamaModel = { name: string; size?: number; details?: { parameter_size?: string } };

async function fetchOllamaModels(): Promise<OllamaModel[] | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j.models) ? j.models : [];
  } catch {
    return null; // ollama not running / unreachable
  }
}

function formatLocalSize(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB local` : `${Math.round(bytes / 1e6)} MB local`;
}

export async function discoverProfiles(): Promise<Discovery> {
  const [nativeDefault, ollamaModels] = await Promise.all([
    readNativeDefault(),
    fetchOllamaModels(),
  ]);
  const ollamaRunning = ollamaModels !== null;
  const profiles: DiscoveredProfile[] = [];

  // Native Anthropic models — available wherever the `claude` CLI is.
  for (const m of MODELS.filter((m) => m.provider === "anthropic")) {
    profiles.push({
      model: m,
      source: "anthropic",
      available: true,
      detail: "Anthropic",
      isDefault:
        !!nativeDefault &&
        (m.launchModel === nativeDefault || m.usageIds.includes(nativeDefault)),
    });
  }

  // Ollama models — discovered live. Enrich with registry metadata when known,
  // otherwise synthesize a profile with an unknown context window.
  for (const om of ollamaModels ?? []) {
    const known = MODELS.find(
      (m) =>
        m.provider === "ollama" &&
        (m.launchModel === om.name || m.usageIds.includes(om.name)),
    );
    const isCloud = om.name.includes(":cloud");
    const model: ModelInfo =
      known ??
      {
        id: `ollama:${om.name}`,
        label: om.name,
        provider: "ollama",
        launchModel: om.name,
        usageIds: [om.name],
        contextWindow: 0, // unknown until configured
        agentCapable: true,
        pricing: isCloud ? null : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        note: om.details?.parameter_size
          ? `${om.details.parameter_size} parameters`
          : undefined,
      };
    profiles.push({
      model,
      source: "ollama",
      available: true,
      detail: isCloud ? "Ollama Cloud" : formatLocalSize(om.size) ?? "Ollama local",
    });
  }

  return { profiles, ollamaRunning, nativeDefaultModel: nativeDefault };
}
