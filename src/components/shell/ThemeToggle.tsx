"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeTheme } from "@/lib/theme";

/** Switches between day (sand) and night (navy). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => null);
  const next = theme === "night" ? "day" : "night";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={theme === null ? "Switch between day and night mode" : `Switch to ${next} mode`}
      className="flex size-tap items-center justify-center rounded-full text-gold transition active:scale-90"
    >
      {/* Shows where the switch will take you: the sun at night, the moon by day. */}
      {theme === "night" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
