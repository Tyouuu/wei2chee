import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "./reset-form";

/** Where the recovery link lands. `/auth/callback` has already established a
 *  session by the time this renders, which is what makes `updateUser` work
 *  without asking for the password the customer has just forgotten. */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth");

  return (
    <AuthShell locale={locale} title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      <ResetPasswordForm locale={locale} />
    </AuthShell>
  );
}
