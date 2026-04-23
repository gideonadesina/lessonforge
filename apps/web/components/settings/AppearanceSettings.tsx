"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { getSavedTheme, setTheme, type Theme } from "@/lib/theme";

export default function AppearanceSettings() {
  const [theme, setLocalTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setLocalTheme(getSavedTheme());
  }, []);

  if (theme === null) return null;

  const themes: Array<{ value: Theme; label: string; icon: React.ReactNode }> =
    [
      { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
      { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
      { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
    ];

  function handleThemeChange(newTheme: Theme) {
    setLocalTheme(newTheme);
    setTheme(newTheme);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 font-semibold text-[var(--text-primary)]">Theme</h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Choose how LessonForge looks on your screen.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {themes.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => handleThemeChange(value)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${
              theme === value
                ? "border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/30"
                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-alt)]"
            }`}
          >
            <div
              className={`${
                theme === value
                  ? "text-violet-700 dark:text-violet-400"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {icon}
            </div>
            <span
              className={`text-xs font-medium ${
                theme === value
                  ? "text-violet-700 dark:text-violet-400"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
