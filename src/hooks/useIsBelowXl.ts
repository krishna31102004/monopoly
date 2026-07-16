"use client";

import { useEffect, useState } from "react";

/** Matches the shared `xl` breakpoint without putting viewport state in GameState. */
export function useIsBelowXl() {
  const [isBelowXl, setIsBelowXl] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsBelowXl(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isBelowXl;
}
