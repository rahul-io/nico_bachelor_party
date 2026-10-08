/** Day (sand) and night (navy) looks. The choice is remembered on the device. */
export type Theme = "day" | "night";

export const THEME_KEY = "nbp.theme";

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "night" ? "night" : "day";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong mode:
 * the saved choice if there is one, otherwise whatever the phone is set to.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="day"&&t!=="night"){t=matchMedia("(prefers-color-scheme: dark)").matches?"night":"day"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="day"}})()`;
