import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME } from "@/lib/brand";
import { StyleColumn, type StyleName } from "./style-column";

const STYLE_ORDER: StyleName[] = ["ledger", "hearth", "blueprint", "bare", "docket", "large", "stamp", "contract"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stylePicker");
  return { title: `${t("title")} · ${BRAND_NAME}` };
}

/**
 * The style-picker gallery — the terminal deliverable of this design-system
 * plan. A client visits this page after signing and compares the three
 * token sets (Ledger / Hearth / Blueprint) rendered against the same
 * sample content, then picks one via a WhatsApp deep link.
 *
 * Page chrome (this header, the footer) intentionally uses the acquisition
 * site's OWN palette (`bg-background`/`text-foreground`, wired in
 * app/globals.css) rather than any of the three design-system token sets —
 * it is the neutral frame the comparison sits inside, not a fourth style
 * competing with the three being compared.
 */
export default async function StylePickerPage() {
  const t = await getTranslations("stylePicker");
  const pageRules = t.raw("contract.pageRules") as string[];
  const layoutRules = t.raw("contract.layoutRules") as string[];
  const componentRules = t.raw("contract.componentRules") as string[];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-10 sm:py-16">
        <header className="max-w-2xl">
          <p className="annotation">
            {BRAND_NAME} / STYLE PICKER
          </p>
          <h1 className="mt-3 font-serif text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15]">{t("title")}</h1>
          <p className="mt-4 text-muted-foreground">{t("subtitle")}</p>
        </header>

        {/* Rows of cards don't stretch — CONTRACT.md's own layout rule,
            applied to itself: items-start lets each column keep its
            natural height instead of all three growing to match the
            tallest one. */}
        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {STYLE_ORDER.map((name) => {
            const label = t(`styles.${name}.label`);
            return (
              <StyleColumn
                key={name}
                styleName={name}
                label={label}
                description={t(`styles.${name}.description`)}
                selectCta={t("selectCta")}
                whatsappPrefillText={t("whatsappPrefill", { style: label })}
              />
            );
          })}
        </div>

        <footer id="contract" className="mt-16 border-t border-border pt-10 pb-6">
          <h2 className="text-lg font-semibold">{t("contract.heading")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("contract.intro")}</p>

          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("contract.pageRulesHeading")}
              </h3>
              <ol className="mt-3 space-y-2 text-sm">
                {pageRules.map((rule, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground">{i + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("contract.layoutRulesHeading")}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {layoutRules.map((rule, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground">–</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("contract.componentRulesHeading")}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {componentRules.map((rule, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground">–</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
