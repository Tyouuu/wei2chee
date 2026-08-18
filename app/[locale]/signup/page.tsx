import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-[20px] font-semibold">{t("signupTitle")}</h1>
      <div className="mt-6">
        <Suspense fallback={null}>
          <SignupForm locale={locale} />
        </Suspense>
      </div>
    </main>
  );
}
