import Link from "next/link";
import { SpikeMark } from "./spike-mark";
import { ThemeToggle } from "./theme-toggle";

const TABS = [
  { key: "sessions", label: "Sessions", href: "/" },
  { key: "launch", label: "Launch", href: "/launch" },
  { key: "analytics", label: "Analytics", href: "/analytics" },
] as const;

export function SiteNav({
  active,
}: {
  active: "sessions" | "launch" | "analytics";
}) {
  return (
    <nav className="sticky top-0 z-30 h-16 border-b border-hairline bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-ink">
            <SpikeMark size={20} className="text-ink" />
            <span className="font-display text-[19px] leading-none text-ink">
              AgentSessions
            </span>
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={`rounded-md px-3 py-1.5 text-[14px] font-medium transition-colors ${
                  active === t.key
                    ? "bg-surface-cream-strong text-ink"
                    : "text-muted hover:bg-surface-soft hover:text-body-strong"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
