"use client";

// Pip positions (cx,cy) as percentage of die face, for each value 1–6
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 28], [70, 72]],
  3: [[30, 28], [50, 50], [70, 72]],
  4: [[30, 28], [70, 28], [30, 72], [70, 72]],
  5: [[30, 28], [70, 28], [50, 50], [30, 72], [70, 72]],
  6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]],
};

type DiceFaceProps = {
  value: number;
  size?: number;
  rolling?: boolean;
  className?: string;
};

export function DiceFace({ value, size = 48, rolling = false, className = "" }: DiceFaceProps) {
  const pips = PIP_LAYOUTS[Math.max(1, Math.min(6, value))] ?? PIP_LAYOUTS[1];
  const r = size * 0.12; // pip radius proportional to die
  const corner = size * 0.18; // border-radius

  return (
    <div
      className={`relative shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: corner,
        background: "linear-gradient(145deg, #ffffff 0%, #f0ede4 100%)",
        boxShadow: rolling
          ? "0 4px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.9)"
          : "0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.9)",
        border: "1.5px solid rgba(0,0,0,0.10)",
        animation: rolling ? "dice-roll 0.35s ease-in-out infinite alternate" : undefined,
        transformOrigin: "center",
      }}
      aria-label={`Die showing ${value}`}
      role="img"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0 }}
      >
        {pips.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={(r / size) * 100}
            fill="#1a1f2e"
            opacity={0.88}
          />
        ))}
      </svg>
    </div>
  );
}

/** Shows two rolling dice or two static dice with pip faces */
export function DiceDisplay({
  die1,
  die2,
  rolling = false,
}: {
  die1: number;
  die2: number;
  rolling?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <DiceFace value={rolling ? ((Date.now() % 6) + 1) : die1} size={44} rolling={rolling} />
      <DiceFace value={rolling ? (((Date.now() + 3) % 6) + 1) : die2} size={44} rolling={rolling} />
    </div>
  );
}
