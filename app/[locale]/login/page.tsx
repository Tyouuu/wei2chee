import { getTranslations } from "next-intl/server";
import { safeNext } from "@/lib/auth/safe-next";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  const next = safeNext((await searchParams).next);
  const t = await getTranslations("auth");

  return (
    <AuthShell locale={locale} title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <LoginForm locale={locale} next={next} />
    </AuthShell>
  );
}
