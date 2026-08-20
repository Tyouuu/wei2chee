"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthField, authSubmitClass } from "@/components/auth-field";

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (signInError) {
      setError(t("errorInvalidCredentials"));
      return;
    }

    router.push("/portal");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AuthField
        id="login-email"
        type="email"
        label={t("signupEmailLabel")}
        placeholder={t("emailPlaceholder")}
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <AuthField
        id="login-password"
        type="password"
        label={t("signupPasswordLabel")}
        placeholder={t("passwordPlaceholder")}
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />

      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? t("loginPending") : t("loginSubmit")}
      </button>

      <p className="text-[13px] text-muted-foreground">
        <Link
          href={`/${locale}/signup`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("loginSwitchToSignup")}
        </Link>
      </p>
    </form>
  );
}
