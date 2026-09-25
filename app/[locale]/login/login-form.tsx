"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthField, authSubmitClass } from "@/components/auth-field";
import { AuthDivider, GoogleButton } from "@/components/oauth-buttons";
import { landingAfterLogin, systemSurfaceOf } from "@/lib/portal/system-surface";

export function LoginForm({ locale, next = null }: { locale: string; next?: string | null }) {
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
      /* 🔴 **每一种失败讲同一句话，是一条会把他推去重设密码的路。**
         2026-09-07 量到的那一串：那颗按钮在下一页来之前就变回「登入」→
         他以为没反应 → 再按 → 每一次都是真的呼叫 → 被挡下来 →
         而画面写着「邮箱或密码不正确」→ **他去重设密码**，
         然后额度用得更快。

         挡下来跟打错密码是两件完全不同的事，而他从画面上分不出来。
         Supabase 那一边给得出：429 是挡下来的，`.status` 缺了就是
         连不上（网路断了 · 伺服器倒了）—— 那两种都不是他的密码。 */
      const status = (signInError as { status?: number }).status;
      setError(
        status === 429
          ? t("errorTooMany")
          : status === undefined
            ? t("errorUnreachable")
            : t("errorInvalidCredentials"),
      );
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

    /* 🔴 **不要在这里放掉 `pending`。**
       `router.push` 是非同步的 —— 下一页要一两秒才来，而这一行会让那颗
       按钮在那一两秒里变回「登入」，看起来完全像没反应。
       他会再按一次、再一次，而每一次都是一通真的呼叫；按几次就被挡下来，
       然后画面写「邮箱或密码不正确」，然后他去重设密码。

       登入成功之后这个组件本来就会被换掉，所以「一直转到画面换掉为止」
       才是对的。⚠️ 代价写出来：万一那一跳没走成，那颗按钮会一直是灰的 ——
       而那比上面那一串好，因为它不会把他送去重设一个没有坏的密码。 */
    /* WHERE HE LANDS IS DECIDED IN ONE PLACE (lib/portal/system-surface.ts):
       a salon account opens the salon system, everyone else the platform home.
       `next` was already checked to be a path on this site (lib/auth/safe-next.ts)
       and wins over both. The founder's console is never redirected by a link.
       One extra round trip, on the one screen where it is invisible. */
    let target = "/console";
    if (!founder) {
      const { data: context } = await supabase.rpc("get_my_business_context");
      target = landingAfterLogin({ locale, surface: systemSurfaceOf(context), next });
    }
    router.push(target);
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
