import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon } from "@/components/ui/UiIcon";

type EntryShellProps = {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
};

/** Shared, presentation-only shell for all pre-game routes. */
export function EntryShell({ children, backHref, backLabel = "Back", className = "" }: EntryShellProps) {
  return (
    <main className={`wc-midnight-shell min-h-screen px-4 py-5 sm:px-6 sm:py-8 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          {backHref ? <Link className="wc-button wc-button-ghost text-sm" href={backHref}><UiIcon name="back" size={16} />{backLabel}</Link> : <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wc-gold-border)] bg-[var(--wc-gold-soft)] text-[var(--wc-gold)]"><UiIcon name="home" size={18} /></span><div><p className="wc-section-label">Private world tour</p><p className="text-sm font-bold text-white">World Cities</p></div></div>}
          <p className="hidden text-xs text-slate-400 sm:block">Private rooms · No account required</p>
        </header>
        {children}
      </div>
    </main>
  );
}
