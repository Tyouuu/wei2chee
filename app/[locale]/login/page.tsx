import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-[20px] font-semibold">{t("loginTitle")}</h1>
      <div className="mt-6">
        <LoginForm locale={locale} />
      </div>
    </main>
  );
}
