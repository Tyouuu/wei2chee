import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { StyleSelectClient } from "./style-select-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * The one-time style-selection step a customer sees on first login, before
 * the editor unlocks. Auth guard follows the `getSessionUser()` pattern
 * Task 2 established for server components (this is that helper's first
 * real consumer -- login/page.tsx itself doesn't need it, it's the page
 * that produces the session) -- signed-out visitors bounce to /login.
 *
 * This page's own chrome (heading, subtitle) deliberately uses the
 * acquisition site's own Tailwind theme (`text-foreground` /
 * `text-muted-foreground`, wired in app/globals.css) rather than any of the
 * three design-system token sets, matching the public `/style-picker`
 * page's own chrome for the same reason: it sits outside any <StyleColumn>
 * scope, so it's the neutral frame the comparison sits inside, not a
 * fourth style competing with the three being compared.
 */
export default async function StyleSelectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const t = await getTranslations("portal.styleSelect");

  // Which of the three styles suits this business, from the industry it told us
  // about during the acquisition flow. Advisory only -- the customer still picks
  // and can pick any of the three -- but asking someone to make an irreversible
  // choice between three names they have never seen, with no hint at all, was a
  // real dead end in the journey. Null for an account that signed up without the
  // questionnaire; the badge is simply omitted then.
  const supabase = await createSessionSupabaseClient();
  const { data: context } = await supabase.rpc("get_my_business_context");
  const recommendation = (context as { industry?: { style_recommendation?: string } } | null)
    ?.industry?.style_recommendation;
  const recommended = (["ledger", "hearth", "blueprint"] as const).includes(
    recommendation as StyleName,
  )
    ? (recommendation as StyleName)
    : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-[24px] font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-10">
        <StyleSelectClient recommended={recommended} />
      </div>
    </main>
  );
}
