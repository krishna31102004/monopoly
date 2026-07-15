import { notFound } from "next/navigation";
import { UiIcon, type UiIconName } from "@/components/ui/UiIcon";
import { CITY_COLOR_HEX } from "@/lib/ui/propertyColors";

const propertyBands = [
  ["Brown", CITY_COLOR_HEX.brown],
  ["Light Blue", CITY_COLOR_HEX["light-blue"]],
  ["Pink", CITY_COLOR_HEX.pink],
  ["Orange", CITY_COLOR_HEX.orange],
  ["Red", CITY_COLOR_HEX.red],
  ["Yellow", CITY_COLOR_HEX.yellow],
  ["Green", CITY_COLOR_HEX.green],
  ["Dark Blue", CITY_COLOR_HEX["dark-blue"]],
  ["Airport", "#475569"],
  ["Electric Company", "#2563eb"],
  ["Water Works", "#0891b2"],
] as const;

const iconNames: UiIconName[] = ["trade", "log", "players", "dice", "home", "copy", "check", "warning", "mortgage", "building", "hotel", "airport", "utility", "jail", "card", "timer", "online"];

export default function DesignSystemShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="wc-midnight-shell min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="wc-section-label">Development only · Phase 1</p>
          <h1 className="wc-display">World Cities design system</h1>
          <p className="max-w-2xl text-slate-300">Shared visual foundations for the midnight application shell and warm physical board surfaces. This route is intentionally not linked from gameplay.</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="wc-panel space-y-4">
            <div><p className="wc-section-label">Typography & numbers</p><h2 className="wc-heading mt-1">Clear, compact hierarchy</h2></div>
            <div className="space-y-2"><p className="wc-panel-heading">Panel heading</p><p className="text-slate-300">Body copy stays calm and readable in dense game states.</p><p className="wc-caption">Caption and supporting information</p></div>
            <div className="flex flex-wrap gap-3"><span className="wc-card wc-numeric text-xl font-bold">$12,450</span><span className="wc-card wc-numeric text-xl font-bold">00:28</span><span className="wc-card wc-room-code">WLD-7K9</span></div>
          </div>
          <div className="wc-paper-card space-y-4">
            <div><p className="wc-section-label text-slate-600">Warm surface</p><h2 className="wc-heading mt-1">Physical board paper</h2></div>
            <p className="text-slate-700">Ivory, paper, and board-frame tokens support deed-like details without turning the board into a dark application surface.</p>
            <button className="wc-button wc-button-primary" type="button">Primary action</button>
          </div>
        </section>

        <section className="wc-panel space-y-4">
          <div><p className="wc-section-label">Actions & status</p><h2 className="wc-heading mt-1">Semantic controls</h2></div>
          <div className="flex flex-wrap gap-3">
            <button className="wc-button wc-button-primary" type="button">Primary</button><button className="wc-button wc-button-secondary" type="button">Secondary</button><button className="wc-button wc-button-success" type="button">Confirm</button><button className="wc-button wc-button-danger" type="button">Danger</button><button className="wc-button wc-button-warning" type="button">Warning</button><button className="wc-button wc-button-ghost" type="button">Ghost</button><button aria-label="Close example" className="wc-button wc-button-secondary wc-icon-button" type="button"><UiIcon name="close" /></button>
          </div>
          <div className="flex flex-wrap gap-2"><span className="wc-badge wc-badge-gold">CURRENT TURN</span><span className="wc-badge wc-badge-success">READY</span><span className="wc-badge wc-badge-muted">PASSED</span><span className="wc-badge wc-badge-danger">DEBT</span><span className="wc-badge wc-badge-warning">RECONNECTING</span></div>
          <div className="grid gap-3 md:grid-cols-3"><p className="wc-validation wc-validation-info">Informational validation message</p><p className="wc-validation wc-validation-success">Confirmed and available</p><p className="wc-validation wc-validation-danger">Action requires attention</p></div>
        </section>

        <section className="wc-panel space-y-4">
          <div><p className="wc-section-label">Property identity</p><h2 className="wc-heading mt-1">Accents, never generic actions</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{propertyBands.map(([label, color]) => <article className="wc-card space-y-2" key={label}><div className="wc-property-band" style={{ backgroundColor: color }} /><p className="wc-property-heading">{label}</p><p className="wc-caption">Asset band / ownership outline</p></article>)}</div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="wc-panel space-y-4"><div><p className="wc-section-label">Inputs & focus</p><h2 className="wc-heading mt-1">Keyboard-ready controls</h2></div><label className="grid gap-2 text-sm font-semibold">Player name<input className="wc-input" defaultValue="World traveler" /></label><label className="grid gap-2 text-sm font-semibold">Game mode<select className="wc-select" defaultValue="normal"><option value="normal">Normal Game</option><option value="auction">Auction Game</option></select></label><p className="wc-caption">Tab through this section to inspect the shared gold focus treatment.</p></div>
          <div className="wc-panel space-y-4"><div><p className="wc-section-label">Icons</p><h2 className="wc-heading mt-1">Monochrome SVG foundation</h2></div><div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{iconNames.map((name) => <div className="wc-card flex flex-col items-center gap-2 p-3 text-slate-200" key={name}><UiIcon name={name} /><span className="wc-caption text-center">{name}</span></div>)}</div><p className="wc-caption">Decorative icons are hidden from assistive technology; interactive icon buttons require an accessible name.</p></div>
        </section>

        <section className="wc-empty-state"><p className="wc-panel-heading text-slate-100">Motion respects player preferences</p><p className="wc-caption mt-2">Reduced-motion settings shorten nonessential transitions and animations. Presentation never controls gameplay timing.</p></section>
      </div>
    </main>
  );
}
