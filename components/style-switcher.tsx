"use client";

import { Button } from "@/components/ui/button";
import { THEMES, useTheme } from "@/lib/use-theme";

export function StyleSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed bottom-4 right-4 z-40 flex gap-2 rounded-full border bg-background p-2 shadow-lg">
      {THEMES.map((t) => (
        <Button key={t} size="sm" variant={theme === t ? "default" : "ghost"} onClick={() => setTheme(t)}>
          {t}
        </Button>
      ))}
    </div>
  );
}
