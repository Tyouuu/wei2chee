"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Sign in with Google.
 *
 * WHY IT MATTERS MORE HERE THAN IT LOOKS. The customer is a Malaysian SME owner
 * who has just been asked to invent and remember a password for a product they
 * met two minutes ago. Every comparable product opens with this button, and its
 * absence is not a missing convenience — it is a step where people leave.
 *
 * ONE MANUAL STEP THIS CODE CANNOT DO. Google has to be enabled as a provider
 * in the Supabase dashboard (Authentication → Providers → Google) with a client
 * id and secret from Google Cloud Console, and
 * `https://<project>.supabase.co/auth/v1/callback` registered as an authorised
 * redirect URI there. Until that is done this button returns a provider error,
 * which is why the failure is surfaced to the customer rather than swallowed.
 */
export function GoogleButton({ next = "/portal" }: { next?: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    const { error } = await createBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        // Absolute, because Google redirects the browser back from its own
        // origin. Read from the live location so preview deployments work
        // without a per-environment constant.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setPending(false);
      setFailed(true);
    }
    // On success the browser is already navigating to Google; leaving `pending`
    // true keeps the button from being pressed twice during that hop.
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/70 text-[14px] font-medium transition-colors hover:bg-background disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <GoogleMark />
        {pending ? t("googlePending") : t("googleCta")}
      </button>
      {failed && (
        <p role="alert" className="text-[12px] text-destructive">
          {t("googleFailed")}
        </p>
      )}
    </div>
  );
}

/** Google's own mark. Kept as inline paths rather than an image so it renders
 *  at any size without a network request on the sign-in page's critical path. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.6c-.1 1.1-.9 2.8-2.5 3.9l-.02.15 3.6 2.8.25.03c2.3-2.1 3.6-5.2 3.6-8.8"
      />
      <path
        fill="#34A853"
        d="M12 24c3.3 0 6-1.1 8-2.9l-3.8-3c-1 .7-2.4 1.2-4.2 1.2a7.3 7.3 0 0 1-6.9-5l-.14.01-3.7 2.9-.05.14C3.2 21.3 7.3 24 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.3a7.2 7.2 0 0 1 0-4.6V6.6l-3.8.02a12 12 0 0 0 0 10.8z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2.4 0 4 1 4.9 1.9l3.6-3.5C18.3 1.2 15.3 0 12 0 7.3 0 3.2 2.7 1.3 6.6l3.8 3a7.3 7.3 0 0 1 6.9-4.9"
      />
    </svg>
  );
}

/** The rule between "sign in with Google" and the email form. A labelled rule
 *  rather than a gap, because two stacked options with no separator read as one
 *  broken form. */
export function AuthDivider() {
  const t = useTranslations("auth");
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[12px] text-muted-foreground">{t("or")}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
