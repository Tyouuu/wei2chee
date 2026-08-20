import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth");

  return (
    <AuthShell locale={locale} title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <LoginForm locale={locale} />
    </AuthShell>
  );
}
