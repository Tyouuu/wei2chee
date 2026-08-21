"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { zh: "中文", en: "EN" };

/**
 * Switches between the app's locales, keeping the visitor where they are.
 *
 * WHY IT DID NOT EXIST AND SHOULD HAVE: the whole app is built on
 * locale-prefixed routes, every string is in `messages/{zh,en}.json`, and
 * `/en` renders correctly end to end — there was simply no control anywhere to
 * reach it. The English half of the product was real and unreachable, which is
 * worse than not having it: the work is paid for and delivering nothing.
 *
 * It matters more here than in most products. This sells to Malaysian SME
 * owners, where one business commonly has a Chinese-speaking owner and
 * English-speaking staff looking at the same screen — and the person being
 * shown a demo is not always the person who reads Chinese comfortably.
 *
 * `usePathname()` here includes the locale segment, because this app routes
 * through `app/[locale]/...` directly rather than through next-intl's own
 * navigation wrappers — the same assumption `rail-nav.tsx` already relies on
 * when it matches an item's href against the live path. So switching is a
 * swap of the first segment, and the visitor keeps their page.
 */
export function LocaleSwitcher({ tone = "light" }: { tone?: "light" | "dark" | "page" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    // Anchored to the string start and limited to the known locales, so a path
    // that merely CONTAINS a locale-like segment ("/zh/portal/en-route") only
    // ever has its prefix rewritten.
    const stripped = pathname.replace(new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`), "");
    startTransition(() => router.push(`/${next}${stripped || ""}`));
  }

  // Every colour carries a literal fallback, because this control is mounted in
  // two places that do NOT share a token set: inside the portal it sits in a
  // `.ledger`/`.hearth`/`.blueprint` scope where --color-nav-* and --color-paper
  // are defined, and on the acquisition site it sits on app/globals.css's own
  // marketing tokens, where they are not. Without the fallback an undefined
  // custom property leaves `color` at its inherited value, which on the dark
  // Hero is near-black text on a near-black ground — invisible, and invisible
  // in exactly the place a visitor most needs to find it.
  // A THIRD TONE, for the one surface that is both. The landing page turns
  // from Formae's dark ground to white paper as you scroll past the showroom
  // (components/handover.tsx), so neither fixed tone works there: `dark`
  // renders white-on-white below the handover, which is what the header's own
  // switcher did — measured as an invisible 「中文 / EN」 with only the slash
  // showing. `page` reads the marketing palette's own tokens, which the
  // handover is already interpolating, so it inverts along with everything
  // else and needs no fallback of its own.
  const base =
    tone === "dark"
      ? "text-[color:var(--color-nav-fg-dim,rgba(255,255,255,0.62))] hover:text-[color:var(--color-nav-fg,#ffffff)]"
      : tone === "page"
        ? "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        : "text-[color:var(--color-paper-dim,#5b6d82)] hover:text-[color:var(--color-paper,#14273d)]";
  const activeTone =
    tone === "dark"
      ? "text-[color:var(--color-nav-fg,#ffffff)] [font-weight:var(--fw-semibold,600)]"
      : tone === "page"
        ? "text-[color:var(--foreground)] [font-weight:var(--fw-semibold,600)]"
        : "text-[color:var(--color-paper,#14273d)] [font-weight:var(--fw-semibold,600)]";

  return (
    <div
      className={`flex items-center gap-1 ${pending ? "opacity-50" : ""}`}
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((code, i) => (
        <span key={code} className="flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="opacity-30">
              /
            </span>
          )}
          <button
            type="button"
            onClick={() => switchTo(code)}
            aria-current={code === locale ? "true" : undefined}
            // `lang` on the button itself: the label for a language is written
            // IN that language, so a screen reader announcing "中文" while set
            // to English reads it character by character without this.
            lang={code}
            className={`rounded px-1.5 py-0.5 transition-colors ${code === locale ? activeTone : base}`}
          >
            {LABELS[code] ?? code.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
