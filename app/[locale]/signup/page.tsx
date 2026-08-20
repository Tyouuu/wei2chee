import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "./signup-form";
import { AuthShell } from "@/components/auth-shell";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth");

  return (
    <AuthShell locale={locale} title={t("signupTitle")} subtitle={t("signupSubtitle")}>
      <Suspense fallback={null}>
        <SignupForm locale={locale} />
      </Suspense>
    </AuthShell>
  );
}
