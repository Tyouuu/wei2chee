"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthField, authSubmitClass } from "@/components/auth-field";

export function ResetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null while unknown: the session is read asynchronously and rendering the
  // form before the answer arrives would flash a form that cannot submit.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    createBrowserSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setHasSession(Boolean(data.session)));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("resetMismatch"));
      return;
    }
    setPending(true);
    setError(null);

    const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({
      password,
    });
    setPending(false);

    if (updateError) {
      setError(t("resetFailed"));
      return;
    }
    router.push(`/${locale}/portal`);
  }

  // An expired or already-used link. Saying so, with the way back, beats a form
  // that accepts a new password and then fails on submit.
  if (hasSession === false) {
    return (
      <div className="rounded-lg border border-border bg-background/60 p-5">
        <h2 className="text-[15px] font-semibold">{t("resetExpiredTitle")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {t("resetExpiredBody")}
        </p>
        <Link
          href={`/${locale}/forgot-password`}
          className="mt-4 inline-block text-[13px] text-primary underline-offset-4 hover:underline"
        >
          {t("forgotSubmit")} →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AuthField
        id="reset-password"
        type="password"
        label={t("resetNewLabel")}
        placeholder={t("passwordPlaceholder")}
        autoComplete="new-password"
        minLength={8}
        hint={t("passwordHint")}
        value={password}
        onChange={setPassword}
      />
      <AuthField
        id="reset-confirm"
        type="password"
        label={t("resetConfirmLabel")}
        placeholder={t("passwordPlaceholder")}
        autoComplete="new-password"
        minLength={8}
        value={confirm}
        onChange={setConfirm}
      />
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending || hasSession === null} className={authSubmitClass}>
        {pending ? t("resetPending") : t("resetSubmit")}
      </button>
    </form>
  );
}
