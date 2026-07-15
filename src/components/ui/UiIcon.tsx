import type { ReactNode, SVGProps } from "react";

export type UiIconName =
  | "trade"
  | "players"
  | "dice"
  | "home"
  | "back"
  | "close"
  | "copy"
  | "check"
  | "warning"
  | "decline"
  | "mortgage"
  | "building"
  | "hotel"
  | "airport"
  | "utility"
  | "jail"
  | "card"
  | "timer"
  | "online";

type UiIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: UiIconName;
  title?: string;
  size?: number;
};

const paths: Record<UiIconName, ReactNode> = {
  trade: <><path d="M4 7h12l-3-3" /><path d="m16 17H4l3 3" /></>,
  players: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.7-3 2.8-5 6-5s5.3 2 6 5" /><path d="M16 5a3 3 0 0 1 0 6" /><path d="M19 20c-.3-1.8-1.1-3.1-2.5-4" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="8" cy="8" r=".7" fill="currentColor" /><circle cx="16" cy="16" r=".7" fill="currentColor" /><circle cx="12" cy="12" r=".7" fill="currentColor" /></>,
  home: <><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
  back: <><path d="m14 5-7 7 7 7" /><path d="M7 12h13" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  copy: <><rect x="9" y="9" width="10" height="10" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  warning: <><path d="M12 3 2.7 20h18.6L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  decline: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6" /><path d="m15 9-6 6" /></>,
  mortgage: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /><path d="m4 4 16 16" /></>,
  building: <><path d="M4 21V5l8-3v19" /><path d="M12 21V9l8-2v14" /><path d="M7 8h1M7 12h1M7 16h1M15 12h1M15 16h1" /></>,
  hotel: <><path d="M3 21h18" /><path d="M5 21V8h14v13" /><path d="M8 8V4h8v4" /><path d="M8 12h2M14 12h2M8 16h2M14 16h2" /></>,
  airport: <><path d="m3 13 8.5-2.5L15 4l2 1-2 6 5 1.5v2l-5-1.5 2 5-2 1-3.5-5.5L3 15v-2Z" /></>,
  utility: <path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z" />,
  jail: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 3v18M12 3v18M16 3v18" /></>,
  card: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /><path d="M9 3h6" /></>,
  online: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
};

/** Small dependency-free, monochrome icons for shared application UI. */
export function UiIcon({ name, size = 20, title, ...props }: UiIconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      fill="none"
      height={size}
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
