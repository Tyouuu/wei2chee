"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthField, authSubmitClass } from "@/components/auth-field";
import { AuthDivider, GoogleButton } from "@/components/oauth-buttons";

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

    if (signInError) {
      setPending(false);
      setError(t("errorInvalidCredentials"));
      return;
    }

    /*
      WHERE SIGNING IN LANDS YOU DEPENDS ON WHO YOU ARE.

      This used to be `/portal` for everyone, which was fine while the console
      lived inside the portal. It does not any more, and on the admin
      deployment `/portal` is not served at all -- so a founder signing in
      there would land on a 404. One extra round trip, on the one screen where
      an extra round trip is invisible.

      A customer who somehow reaches the admin deployment's login still goes to
      /portal and gets a 404 there. That is correct: this deployment does not
      have a customer product to show them.
    */
    const { data: founder } = await supabase.rpc("is_founder");

    setPending(false);
    router.push(founder ? "/console" : "/portal");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Above the form, not below it: this is the path most people take, and
          burying it under two fields they have already started filling in is
          how you get both. */}
      <GoogleButton />
      <AuthDivider />

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
      <div>
        <AuthField
          id="login-password"
          type="password"
          label={t("signupPasswordLabel")}
          placeholder={t("passwordPlaceholder")}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        <Link
          href={`/${locale}/forgot-password`}
          className="mt-2 inline-block text-[12.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("forgotCta")}
        </Link>
      </div>

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
    </div>
  );
}
