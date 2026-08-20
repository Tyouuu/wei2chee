"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * The error boundary.
 *
 * There wasn't one, so any thrown render error showed Next's default error
 * screen. This one does the two things that matter: it offers a retry (most of
 * what breaks here is a failed Supabase read, which usually succeeds on the
 * second try), and it does NOT print `error.message` — those messages come from
 * Postgres and OpenAI and would put internal detail in front of a customer.
 * The digest is shown instead, because that is the string the founder can
 * search the logs by when someone reports it.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("system");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-destructive">
        {t("errorLabel")}
      </span>
      <h1 className="mt-4 font-serif text-[2rem] leading-tight tracking-[-0.025em]">
        {t("errorTitle")}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{t("errorBody")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t("errorRetry")}
      </button>
      {error.digest && (
        <p className="mt-6 font-mono text-[11px] text-muted-foreground">{error.digest}</p>
      )}
    </main>
  );
}
