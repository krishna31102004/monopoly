import { TokenIcon } from "@/components/board/TokenIcon";
import { getTokenPresentation } from "@/lib/ui/tokenPresentation";
import type { PlayerToken } from "@/types/player";

type TokenMedallionProps = {
  token: PlayerToken;
  selected?: boolean;
  unavailable?: boolean;
  compact?: boolean;
};

/** Presentation-only token content for native controls and player manifests. */
export function TokenMedallion({ token, selected = false, unavailable = false, compact = false }: TokenMedallionProps) {
  const presentation = getTokenPresentation(token);
  if (!presentation) return null;

  return (
    <div className={`flex items-center gap-2 ${unavailable ? "opacity-45" : ""}`}>
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30"
        style={{ backgroundColor: presentation.color }}
      >
        <TokenIcon token={token} color="#ffffff" size={compact ? 20 : 25} label={presentation.displayName} />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">{presentation.displayName}</span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {unavailable ? "Unavailable" : selected ? "Selected" : presentation.tokenLabel}
          </span>
        </span>
      )}
    </div>
  );
}
