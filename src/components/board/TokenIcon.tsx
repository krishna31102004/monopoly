import React from "react";
import { hasTokenIcon } from "@/lib/tokenMeta";
import type { PlayerToken } from "@/types/player";

export { hasTokenIcon };

type TokenIconProps = {
  token: PlayerToken;
  color: string;
  size?: number;
  label?: string;
  /** If true, renders a circular badge (board usage). Otherwise renders icon only. */
  badge?: boolean;
};

// ── SVG paths for each token ──────────────────────────────────────────────────

function CarSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <path d="M5 11l1.5-4.5h11L19 11" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="3" y="11" width="18" height="6" rx="2" />
      <circle cx="7" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
      <rect x="7" y="9" width="4" height="2.5" rx="0.5" fill="rgba(255,255,255,0.4)" />
      <rect x="13" y="9" width="4" height="2.5" rx="0.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function HatSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <ellipse cx="12" cy="17" rx="9" ry="2.5" />
      <rect x="8" y="7" width="8" height="10" rx="1" />
      <ellipse cx="12" cy="7" rx="4" ry="1.5" />
      {/* brim highlight */}
      <ellipse cx="12" cy="17" rx="9" ry="1" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

function ShipSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      {/* hull */}
      <path d="M3 14 Q12 19 21 14 L19 17 Q12 21 5 17 Z" />
      {/* cabin */}
      <rect x="9" y="9" width="6" height="5" rx="1" />
      {/* mast */}
      <line x1="12" y1="4" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" />
      {/* flag */}
      <path d="M12 4 L16 5.5 L12 7 Z" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

function ShoeSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      {/* sole */}
      <path d="M2 17 Q2 19 5 19 L19 19 Q21 19 21 17.5 Q21 16 19 16 L14 16 L12 10 Q11 7 9 7 L7 7 Q5 7 4 9 L3 13 L2 17 Z" />
      {/* toe highlight */}
      <ellipse cx="18" cy="17.5" rx="2.5" ry="1" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

function DogSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      {/* body */}
      <ellipse cx="12" cy="15" rx="6" ry="4" />
      {/* head */}
      <circle cx="17" cy="10" r="3.5" />
      {/* ear */}
      <ellipse cx="15" cy="7.5" rx="1.5" ry="2.5" transform="rotate(-15 15 7.5)" />
      {/* tail */}
      <path d="M6 13 Q2 10 3 7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* legs */}
      <rect x="8" y="18" width="2" height="3" rx="1" />
      <rect x="13" y="18" width="2" height="3" rx="1" />
      {/* nose */}
      <circle cx="19.5" cy="11" r="0.8" fill="rgba(0,0,0,0.4)" />
    </svg>
  );
}

function CatSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      {/* body */}
      <ellipse cx="12" cy="15.5" rx="6" ry="4.5" />
      {/* head */}
      <circle cx="12" cy="9" r="4" />
      {/* ears */}
      <path d="M8.5 6 L7 3 L10 5.5 Z" />
      <path d="M15.5 6 L17 3 L14 5.5 Z" />
      {/* tail */}
      <path d="M18 16 Q22 12 20 8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <ellipse cx="10.5" cy="9" rx="0.8" ry="1" fill="rgba(0,0,0,0.45)" />
      <ellipse cx="13.5" cy="9" rx="0.8" ry="1" fill="rgba(0,0,0,0.45)" />
    </svg>
  );
}

const TOKEN_ICONS: Record<PlayerToken, () => React.ReactElement> = {
  car: CarSVG,
  hat: HatSVG,
  ship: ShipSVG,
  shoe: ShoeSVG,
  dog: DogSVG,
  cat: CatSVG,
};

/**
 * Renders a player token as a colored SVG icon.
 * `badge=true` wraps in a circular badge with shadow (board/panel usage).
 */
export function TokenIcon({ token, color, size = 28, label, badge = false }: TokenIconProps) {
  const Icon = TOKEN_ICONS[token] ?? HatSVG;
  const title = label ?? token;

  const iconEl = (
    <span
      title={title}
      aria-label={title}
      style={{ color, width: size, height: size, display: "inline-flex" }}
    >
      <Icon />
    </span>
  );

  if (!badge) return iconEl;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full border-2 border-white shadow-md"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        padding: Math.round(size * 0.12),
        boxSizing: "border-box",
        boxShadow: `0 2px 6px rgba(0,0,0,0.28), inset 0 1px 2px rgba(255,255,255,0.25)`,
      }}
      title={title}
      aria-label={title}
    >
      <span style={{ color: "rgba(255,255,255,0.92)", width: "100%", height: "100%", display: "flex" }}>
        <Icon />
      </span>
    </span>
  );
}
