"use client";

import type { GameMode, GameRules } from "@/types/game";

type BooleanRuleKey = Exclude<keyof GameRules, "gameMode">;

const RULE_LABELS: Record<BooleanRuleKey, { label: string; description: string }> = {
  doubleRentOnFullSet: { label: "Double Rent on Full Set", description: "Owner collects 2× base rent for a complete colour group." },
  freeParkingCash: { label: "Free Parking Jackpot", description: "Taxes and fees go into a pot for Free Parking." },
  auctions: { label: "Auctions", description: "Declined properties are auctioned to all players." },
  noRentInJail: { label: "No Rent While in Jail", description: "Players in jail cannot collect rent." },
  mortgages: { label: "Mortgages", description: "Properties can be mortgaged to the bank." },
  evenBuild: { label: "Even Build Rule", description: "Build evenly across a colour group." },
  exactGoBonus: { label: "Exact GO Bonus", description: "Landing exactly on GO collects $300." },
};

const GAME_MODES: ReadonlyArray<{ value: GameMode; label: string; description: string }> = [
  { value: "normal", label: "Normal Game", description: "Buy or decline unowned properties." },
  { value: "auction", label: "Auction Game", description: "Unowned properties go directly to auction." },
];

type Props = { rules: GameRules; onChange: (rules: GameRules) => void; readOnly?: boolean };

export function GameRulesPanel({ rules, onChange, readOnly = false }: Props) {
  function setMode(gameMode: GameMode) {
    if (!readOnly) onChange({ ...rules, gameMode });
  }

  function toggle(key: BooleanRuleKey) {
    if (!readOnly) onChange({ ...rules, [key]: !rules[key] });
  }

  return (
    <section className="wc-panel">
      <header className="mb-4">
        <p className="wc-section-label">Game settings</p>
        <h2 className="wc-panel-heading mt-1 text-white">{readOnly ? "Host-selected rules" : "Choose your rules"}</h2>
        <p className="wc-caption mt-1">{readOnly ? "Rules are shown after the game begins." : "These choices are submitted with Start Game."}</p>
      </header>
      <fieldset>
        <legend className="wc-section-label mb-2">Game mode</legend>
        <div className="grid gap-2">
          {GAME_MODES.map((mode) => (
            <label className={["flex cursor-pointer items-center gap-3 rounded-[var(--wc-radius-medium)] border p-3", rules.gameMode === mode.value ? "border-[var(--wc-gold-border)] bg-[var(--wc-gold-soft)]" : "border-[var(--wc-border)] bg-[var(--wc-navy-raised)]", readOnly ? "cursor-default opacity-70" : ""].join(" ")} key={mode.value}>
              <input checked={rules.gameMode === mode.value} className="h-4 w-4 accent-[var(--wc-gold)]" disabled={readOnly} name="game-mode" onChange={() => setMode(mode.value)} type="radio" value={mode.value} />
              <span><span className="block text-sm font-bold text-white">{mode.label}</span><span className="wc-caption">{mode.description}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 border-t border-[var(--wc-border-subtle)] pt-4">
        <p className="wc-section-label">House rules</p>
        <div className="mt-2 divide-y divide-[var(--wc-border-subtle)]">
          {(Object.keys(RULE_LABELS) as BooleanRuleKey[]).map((key) => (
            <div className="flex items-center gap-3 py-3" key={key}>
              <div className="flex-1"><p className="text-sm font-bold text-white">{RULE_LABELS[key].label}</p><p className="wc-caption">{RULE_LABELS[key].description}</p></div>
              <button aria-pressed={rules[key]} className={["min-h-[44px] min-w-[44px] rounded-[var(--wc-radius-small)] border px-3 text-xs font-bold", rules[key] ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" : "border-[var(--wc-border)] bg-[var(--wc-navy-raised)] text-slate-300 hover:bg-[var(--wc-navy-hover)]"].join(" ")} disabled={readOnly} onClick={() => toggle(key)} type="button">{rules[key] ? "ON" : "OFF"}</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { GAME_MODES, RULE_LABELS };
