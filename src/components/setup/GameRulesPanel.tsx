"use client";

import type { GameMode, GameRules } from "@/types/game";

type BooleanRuleKey = Exclude<keyof GameRules, "gameMode">;

const RULE_LABELS: Record<BooleanRuleKey, { label: string; description: string }> = {
  doubleRentOnFullSet: {
    label: "Double Rent on Full Set",
    description: "Owner collects 2× base rent when they own all properties in a colour group.",
  },
  freeParkingCash: {
    label: "Free Parking Jackpot",
    description: "Taxes and fees go into a pot; landing on Free Parking wins the pot.",
  },
  auctions: {
    label: "Auctions",
    description: "When a player declines to buy, the property is auctioned to all players.",
  },
  noRentInJail: {
    label: "No Rent While in Jail",
    description: "A player who is in jail cannot collect rent from other players.",
  },
  mortgages: {
    label: "Mortgages",
    description: "Players can mortgage properties to the bank for half price.",
  },
  evenBuild: {
    label: "Even Build Rule",
    description: "Houses must be built evenly across all properties in a colour group.",
  },
  exactGoBonus: {
    label: "Exact GO Bonus",
    description: "Collect $300 when landing exactly on GO. Passing GO still gives $200.",
  },
};

const GAME_MODES: { value: GameMode; label: string; description: string }[] = [
  {
    value: "normal",
    label: "Normal Game",
    description: "Classic purchase rules. Land on unowned property to buy or decline.",
  },
  {
    value: "auction",
    label: "Auction Game",
    description: "Every unowned property goes directly to auction. Free Parking is capped at $500.",
  },
];

type GameRulesPanelProps = {
  rules: GameRules;
  onChange: (rules: GameRules) => void;
  readOnly?: boolean;
};

export function GameRulesPanel({ rules, onChange, readOnly = false }: GameRulesPanelProps) {
  function toggle(key: BooleanRuleKey) {
    if (readOnly) return;
    onChange({ ...rules, [key]: !rules[key] });
  }

  function setGameMode(mode: GameMode) {
    if (readOnly) return;
    onChange({ ...rules, gameMode: mode });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      {/* Game Mode selector */}
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-black text-slate-950">Game Mode</h2>
        <p className="text-sm font-semibold text-slate-500">
          {readOnly ? "Mode set by the host." : "Choose how property landings work."}
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {GAME_MODES.map((mode) => {
          const isSelected = rules.gameMode === mode.value;
          return (
            <div
              key={mode.value}
              className={[
                "flex items-start gap-4 px-5 py-4",
                readOnly ? "" : "cursor-pointer hover:bg-slate-50",
                isSelected ? "bg-slate-50" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setGameMode(mode.value)}
              role={readOnly ? undefined : "radio"}
              aria-checked={isSelected}
              tabIndex={readOnly ? undefined : 0}
              onKeyDown={
                readOnly
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setGameMode(mode.value);
                      }
                    }
              }
            >
              {/* Radio indicator */}
              <span
                className={[
                  "relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-slate-300 bg-white",
                ].join(" ")}
                aria-hidden="true"
              >
                {isSelected && (
                  <span className="inline-block h-2 w-2 rounded-full bg-white" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950">{mode.label}</p>
                <p className="text-xs font-semibold text-slate-500">{mode.description}</p>
              </div>
              {isSelected && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                  Selected
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* House Rules toggles */}
      <div className="border-t border-slate-100 px-5 py-4">
        <h2 className="text-lg font-black text-slate-950">House Rules</h2>
        <p className="text-sm font-semibold text-slate-500">
          {readOnly ? "Rules set by the host." : "Toggle optional rules before starting."}
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {(Object.keys(RULE_LABELS) as BooleanRuleKey[]).map((key) => {
          const { label, description } = RULE_LABELS[key];
          const isOn = rules[key] as boolean;
          return (
            <div
              key={key}
              className={[
                "flex items-start gap-4 px-5 py-4",
                readOnly ? "" : "cursor-pointer hover:bg-slate-50",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => toggle(key)}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              onKeyDown={
                readOnly
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(key);
                      }
                    }
              }
              aria-pressed={readOnly ? undefined : isOn}
            >
              {/* Toggle switch */}
              <span
                className={[
                  "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  isOn ? "bg-emerald-500" : "bg-slate-200",
                  readOnly ? "opacity-70" : "",
                ].join(" ")}
                aria-hidden="true"
              >
                <span
                  className={[
                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                    isOn ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950">{label}</p>
                <p className="text-xs font-semibold text-slate-500">{description}</p>
              </div>

              <span
                className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                  isOn
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500",
                ].join(" ")}
              >
                {isOn ? "ON" : "OFF"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
