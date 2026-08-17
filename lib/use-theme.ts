"use client";

import { useEffect, useSyncExternalStore } from "react";

export const THEMES = ["default", "warm-professional", "industrial"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "formae-theme";

// NOTE: the Task 14 brief's reference snippet for this hook used a plain
// `useState` + two `useEffect`s local to each call site. That works fine when
// only one component calls `useTheme()`, but this project has (at least) two
// consumers — StyleSwitcher and HeroSection — and the brief's own interface
// contract calls for "the shared useTheme() hook" so HeroSection can react to
// theme changes made via the switcher. With per-call-site `useState`, clicking
// a theme button in StyleSwitcher updated `data-theme`/localStorage globally
// (verified: colors/radius changed correctly) but HeroSection's own `theme`
// value never changed, so the industrial GlitchText branch only ever appeared
// after a full page reload — failing the brief's Step 7 manual check ("confirm
// switching away from industrial reverts it to the plain headline" implies
// live switching, not reload-to-see). Fixed by moving to a small module-level
// store shared via React's built-in `useSyncExternalStore` (no new dependency)
// so every component reading `useTheme()` re-renders in lockstep.

let currentTheme: Theme = "default";
let hasHydrated = false;
const listeners = new Set<() => void>();

function isValidTheme(value: string | null): value is Theme {
  return !!value && (THEMES as readonly string[]).includes(value);
}

function applyThemeToDocument(theme: Theme) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

function setTheme(theme: Theme) {
  currentTheme = theme;
  applyThemeToDocument(theme);
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return currentTheme;
}

function getServerSnapshot(): Theme {
  return "default";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Runs once across the whole app (guarded by the module-level `hasHydrated`
  // flag, which resets naturally on a real page load), regardless of how many
  // components mount and call useTheme().
  useEffect(() => {
    if (hasHydrated) return;
    hasHydrated = true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(stored)) {
      setTheme(stored);
    }
  }, []);

  return { theme, setTheme };
}
