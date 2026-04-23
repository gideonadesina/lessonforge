export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "lessonforge-theme";

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getSavedTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  return saved && ["light", "dark", "system"].includes(saved) ? saved : "light";
}

export function getEffectiveTheme(): "light" | "dark" {
  const saved = getSavedTheme();
  if (saved === "system") {
    return getSystemTheme();
  }
  return saved;
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return;

  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

  if (effectiveTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function initTheme(): void {
  if (typeof window === "undefined") return;
  const theme = getSavedTheme();
  applyTheme(theme);

  // Listen for system theme changes when set to system
  if (theme === "system") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => {
      if (getSavedTheme() === "system") {
        applyTheme("system");
      }
    });
  }
}
