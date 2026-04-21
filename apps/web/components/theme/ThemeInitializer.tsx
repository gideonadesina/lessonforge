"use client";

import { useEffect } from "react";
import { initTheme } from "@/lib/theme";

export default function ThemeInitializer() {
  useEffect(() => {
    initTheme();
  }, []);

  return null;
}
