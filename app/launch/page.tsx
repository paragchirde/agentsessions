import { discoverProfiles } from "@/lib/discovery";
import { listProjectGroups } from "@/lib/sessions";
import { SiteNav } from "../components/site-nav";
import { LaunchClient, type DiscoveredDTO } from "./launch-client";

export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const [{ profiles, ollamaRunning }, groups] = await Promise.all([
    discoverProfiles(),
    listProjectGroups(),
  ]);

  const discovered: DiscoveredDTO[] = profiles.map((p) => ({
    model: p.model,
    source: p.source,
    detail: p.detail,
    isDefault: p.isDefault,
  }));
  const projects = groups.map((g) => ({
    name: g.projectName,
    path: g.projectPath,
  }));

  return (
    <div className="min-h-screen bg-canvas">
      <SiteNav active="launch" />

      <div className="mx-auto max-w-[1200px] px-6 pb-24 pt-10">
        <header className="mb-8">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-card px-3 py-1 text-[12px] font-medium uppercase tracking-[1.5px] text-muted">
            New session
          </p>
          <h1 className="font-display text-[44px] leading-[1.05] text-ink">
            Start anywhere, on any model.
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-body">
            Studio detected the model backends available on this machine. Add
            your own, tune any profile, then copy a ready-to-run command.
          </p>
        </header>

        <LaunchClient
          discovered={discovered}
          projects={projects}
          ollamaRunning={ollamaRunning}
        />
      </div>
    </div>
  );
}
