"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthField, authSubmitClass } from "@/components/auth-field";
import { AuthDivider, GoogleButton } from "@/components/oauth-buttons";

export function SignupForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: leadId ? { lead_id: leadId } : undefined,
      },
    });

    setPending(false);

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? t("errorEmailTaken")
          : t("errorGeneric"),
      );
      return;
    }

    if (!data.session) {
      // "Confirm email" is enabled on this project -- signUp() succeeded but
      // granted no session yet. The real session gets established when the
      // visitor clicks the confirmation link, which lands on
      // app/auth/confirm/route.ts.
      setConfirmPending(true);
      return;
    }

    router.push("/portal");
  }

  if (confirmPending) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">{t("confirmPendingTitle")}</h2>
        <p className="text-[13px] text-muted-foreground">{t("confirmPendingBody")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AuthField
        id="signup-email"
        type="email"
        label={t("signupEmailLabel")}
        placeholder={t("emailPlaceholder")}
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <AuthField
        id="signup-password"
        type="password"
        label={t("signupPasswordLabel")}
        placeholder={t("passwordPlaceholder")}
        autoComplete="new-password"
        minLength={8}
        hint={t("passwordHint")}
        value={password}
        onChange={setPassword}
      />

      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? t("signupPending") : t("signupSubmit")}
      </button>

      <p className="text-[13px] text-muted-foreground">
        <Link href={`/${locale}/login`} className="text-primary underline-offset-4 hover:underline">
          {t("signupSwitchToLogin")}
        </Link>
      </p>
      </form>
    </div>
  );
}
