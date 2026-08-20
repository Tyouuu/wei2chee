import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-form";

/**
 * WHY THIS PAGE IS A SEVERITY-ONE GAP AND NOT A NICE-TO-HAVE. Until it existed,
 * a customer who forgot their password was locked out of their own design
 * permanently — there was no reset flow anywhere in the product and no admin
 * screen to help them from. The only recovery was the founder editing
 * auth.users by hand. For a paid product holding the only copy of someone's
 * work, that is data loss with extra steps.
 */
export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth");

  return (
    <AuthShell
      locale={locale}
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={
        <Link
          href={`/${locale}/login`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          ← {t("backToLogin")}
        </Link>
      }
    >
      <ForgotPasswordForm locale={locale} />
    </AuthShell>
  );
}
