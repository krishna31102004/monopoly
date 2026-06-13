"use client";

import type { PlayerToken } from "@/types/player";

const ALL_TOKENS: Array<{ token: PlayerToken; label: string; color: string }> = [
  { token: "car", label: "CAR", color: "#ef4444" },
  { token: "hat", label: "HAT", color: "#2563eb" },
  { token: "ship", label: "SHP", color: "#16a34a" },
  { token: "shoe", label: "SHO", color: "#ca8a04" },
  { token: "dog", label: "DOG", color: "#7c3aed" },
  { token: "cat", label: "CAT", color: "#0891b2" },
];

type Props = {
  selected: PlayerToken | null;
  takenTokens: PlayerToken[];
  onChange: (token: PlayerToken, tokenLabel: string, color: string) => void;
};

export function TokenPicker({ selected, takenTokens, onChange }: Props) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
        Choose token
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_TOKENS.map(({ token, label, color }) => {
          const taken = takenTokens.includes(token) && token !== selected;
          const isSelected = token === selected;
          return (
            <button
              key={token}
              type="button"
              disabled={taken}
              onClick={() => onChange(token, label, color)}
              className={[
                "flex h-12 w-12 items-center justify-center rounded-full text-[10px] font-black text-white transition",
                taken ? "opacity-30 cursor-not-allowed" : "hover:opacity-90 active:scale-95",
                isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : "",
              ].join(" ")}
              style={{ backgroundColor: color }}
              title={taken ? `${label} is taken` : label}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
