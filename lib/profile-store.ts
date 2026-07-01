// Shared client-side store for user profile customizations, persisted in
// localStorage. Both the Launch page and the Sessions switch-model picker read
// from here so a custom/edited model shows up everywhere. Pure functions only
// (call from client components).

import { MODELS, type ModelInfo } from "./models";

export type Override = {
  label?: string;
  contextWindow?: number;
  agentCapable?: boolean;
};

export const K_OVR = "ccs:profile-overrides";
export const K_CUSTOM = "ccs:custom-profiles";
export const K_RECENT = "ccs:recent-launches";

export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage unavailable */
  }
}

export function applyOverride(m: ModelInfo, o?: Override): ModelInfo {
  if (!o) return m;
  return {
    ...m,
    ...(o.label ? { label: o.label } : {}),
    ...(o.contextWindow != null ? { contextWindow: o.contextWindow } : {}),
    ...(o.agentCapable != null ? { agentCapable: o.agentCapable } : {}),
  };
}

// Merge a base model list with stored overrides + custom profiles, deduped by id.
export function mergeModels(
  base: ModelInfo[],
  overrides: Record<string, Override>,
  custom: ModelInfo[],
): ModelInfo[] {
  const out: ModelInfo[] = [];
  const seen = new Set<string>();
  for (const m of base) {
    out.push(applyOverride(m, overrides[m.id]));
    seen.add(m.id);
  }
  for (const c of custom) {
    if (!seen.has(c.id)) {
      out.push(applyOverride(c, overrides[c.id]));
      seen.add(c.id);
    }
  }
  return out;
}

// The full model universe a user can pick from: built-in registry + their
// custom profiles, with overrides applied.
export function allUserModels(
  overrides: Record<string, Override>,
  custom: ModelInfo[],
): ModelInfo[] {
  return mergeModels(MODELS, overrides, custom);
}

// Find the registry/custom model that produced a session's usage id.
export function findModelForUsage(
  models: ModelInfo[],
  usageId: string | null,
): ModelInfo | undefined {
  if (!usageId) return undefined;
  return models.find(
    (m) => m.usageIds.includes(usageId) || m.launchModel === usageId,
  );
}
