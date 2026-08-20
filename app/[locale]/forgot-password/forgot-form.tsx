"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthField, authSubmitClass } from "@/components/auth-field";

export function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);

    await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        `/${locale}/reset-password`,
      )}`,
    });

    setPending(false);
    // SUCCESS IS REPORTED WHETHER OR NOT THE ADDRESS EXISTS, and the error is
    // deliberately not surfaced. A reset form that says "no such account" is an
    // account-enumeration oracle: anyone can walk a list of addresses and learn
    // which ones are customers here. The customer-visible cost is that a typo
    // looks like success, which is why the confirmation names the address back.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-background/60 p-5">
        <h2 className="text-[15px] font-semibold">{t("forgotSentTitle")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {t("forgotSentBody", { email })}
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-[13px] text-primary underline-offset-4 hover:underline"
        >
          {t("forgotResend")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AuthField
        id="forgot-email"
        type="email"
        label={t("signupEmailLabel")}
        placeholder={t("emailPlaceholder")}
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? t("forgotPending") : t("forgotSubmit")}
      </button>
    </form>
  );
}
