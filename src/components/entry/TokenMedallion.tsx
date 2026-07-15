"use client";

import { TokenIcon } from "@/components/board/TokenIcon";
import { getTokenPresentation } from "@/lib/ui/tokenPresentation";
import type { PlayerToken } from "@/types/player";

type TokenMedallionProps = {
  token: PlayerToken;
  selected?: boolean;
  unavailable?: boolean;
  compact?: boolean;
  onSelect?: () => void;
};

/** Accessible token picker/presentation that preserves existing token values. */
export function TokenMedallion({ token, selected = false, unavailable = false, compact = false, onSelect }: TokenMedallionProps) {
  const presentation = getTokenPresentation(token);
  if (!presentation) return null;
  const content = <><span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30" style={{ backgroundColor: presentation.color }}><TokenIcon token={token} color="#ffffff" size={compact ? 20 : 25} label={presentation.displayName} /></span>{!compact && <span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{presentation.displayName}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{unavailable ? "Unavailable" : selected ? "Selected" : presentation.tokenLabel}</span></span>}</>;
  if (!onSelect) return <div className="flex items-center gap-2">{content}</div>;
  return <button type="button" role="radio" aria-checked={selected} aria-label={`${presentation.displayName}${unavailable ? " unavailable" : ""}`} disabled={unavailable} onClick={onSelect} className={["flex min-h-[44px] items-center gap-2 rounded-[var(--wc-radius-medium)] border p-2 text-left transition", selected ? "border-[var(--wc-gold)] bg-[var(--wc-gold-soft)] shadow-[0_0_0_1px_var(--wc-gold-border)]" : "border-[var(--wc-border)] bg-[var(--wc-navy-raised)] hover:bg-[var(--wc-navy-hover)]", unavailable ? "cursor-not-allowed opacity-45" : ""].join(" ")}>{content}</button>;
}
