"use client";

import { TokenMedallion } from "@/components/entry/TokenMedallion";
import { TOKEN_PRESENTATION } from "@/lib/ui/tokenPresentation";
import type { PlayerToken } from "@/types/player";

type Props = {
  selected: PlayerToken | null;
  takenTokens: PlayerToken[];
  onChange: (token: PlayerToken, tokenLabel: string, color: string) => void;
};

export function TokenPicker({ selected, takenTokens, onChange }: Props) {
  return (
    <fieldset>
      <legend className="wc-section-label mb-2">Choose your token</legend>
      <div aria-label="Choose your token" className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
        {TOKEN_PRESENTATION.map((entry) => {
          const taken = takenTokens.includes(entry.token) && entry.token !== selected;
          return <TokenMedallion key={entry.token} token={entry.token} selected={entry.token === selected} unavailable={taken} onSelect={() => onChange(entry.token, entry.tokenLabel, entry.color)} />;
        })}
      </div>
    </fieldset>
  );
}
