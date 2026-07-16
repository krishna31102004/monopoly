"use client";

import { useId } from "react";
import { TokenMedallion } from "@/components/entry/TokenMedallion";
import { TOKEN_PRESENTATION } from "@/lib/ui/tokenPresentation";
import type { PlayerToken } from "@/types/player";

type Props = {
  name?: string;
  selected: PlayerToken | null;
  takenTokens: PlayerToken[];
  onChange: (token: PlayerToken, tokenLabel: string, color: string) => void;
};

export function TokenPicker({ name, selected, takenTokens, onChange }: Props) {
  const generatedName = useId();
  const groupName = name ?? `token-picker-${generatedName}`;
  return (
    <fieldset>
      <legend className="wc-section-label mb-2">Choose your token</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TOKEN_PRESENTATION.map((entry) => {
          const unavailable = takenTokens.includes(entry.token) && entry.token !== selected;
          const checked = entry.token === selected;
          return (
            <label
              className={[
                "relative flex min-h-[44px] cursor-pointer rounded-[var(--wc-radius-medium)] border p-2 transition",
                checked ? "border-[var(--wc-gold)] bg-[var(--wc-gold-soft)] shadow-[0_0_0_1px_var(--wc-gold-border)]" : "border-[var(--wc-border)] bg-[var(--wc-navy-raised)] hover:bg-[var(--wc-navy-hover)]",
                unavailable ? "cursor-not-allowed opacity-45" : "",
              ].join(" ")}
              key={entry.token}
            >
              <input
                checked={checked}
                className="peer sr-only"
                disabled={unavailable}
                name={groupName}
                onChange={() => onChange(entry.token, entry.tokenLabel, entry.color)}
                type="radio"
                value={entry.token}
              />
              <TokenMedallion selected={checked} token={entry.token} unavailable={unavailable} />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
