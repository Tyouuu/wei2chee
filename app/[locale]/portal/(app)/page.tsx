import { redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { PortalHome } from "../home-client";
import { REGISTERED_COMPONENTS } from "@/lib/portal/layout-ops";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import {
  buildPageLayout,
  displayBusinessName,
  displayOwnerName,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";

/**
 * The customer's home.
 *
 * WHY THIS PAGE NOW EXISTS: until now `/portal` had no UI at all — it read
 * `projects.style` and redirected straight to `/portal/dashboard`, which IS the
 * Puck editor. So the first thing a business owner saw after signing in was a
 * drag-and-drop canvas with a component palette down the left side. The
 * founder's objection was exactly right, and it is not a styling one:
 * **no product drops a customer into an authoring tool as their landing
 * surface.** Durable signs you in to a Home — greeting, your site, your
 * modules, your next action — and editing is one destination you choose from
 * it. 21st.dev opens on a gallery you browse. Neither opens on a canvas.
 *
 * So the editor became a destination rather than the front door, and this is
 * the front door: what the system understood about the business, the pages it
 * built, rendered as real miniatures of themselves, and the two things a
 * customer can actually do next (read the specification, hand it over to be
 * built).
 *
 * The layout generation below deliberately mirrors `[pageKey]/page.tsx`
 * exactly. A page that has never been saved is generated on read, not
 * persisted, so a customer who has never opened the editor still sees real
 * pages here — showing five empty cards on the home screen would reintroduce
 * the blank-canvas problem one level up.
 */
export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Session-aware client, not the service-role client: RLS's
  // `projects_select_own` / `project_pages_select_own` policies are the real
  // enforcement, with the `.eq(...)` filters kept for explicitness.
  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style, palette, paid, site_slug, site_published")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, sort_order, layout_json")
    .eq("project_id", project.id);

  // PageRefs, not keys: a custom page carries the customer's own title, and
  // every label in the rail and on this screen comes from it.
  const pageRefs = sortPages(
    (pageRows ?? []).map((r: { page_key: string; title: string | null; sort_order: number | null }) => ({
      key: r.page_key,
      title: r.title,
      sortOrder: r.sort_order,
    })),
  );

  // One call, not one per page: `get_my_business_context` is `security definer`
  // and resolves the lead from auth.uid() internally, so there is no id to pass
  // and nothing here can reach another customer's lead.
  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  // The account chip answers "who am I signed in as", so it wants the person's
  // name. Until they set one in settings, the email's local part is the least
  // bad stand-in -- better than the full address, which would put a customer's
  // email into every screenshot of their own system.
  const ownerName = displayOwnerName(businessContext, user.email?.split("@")[0] || "我");

  const pages = pageRefs.map((ref) => {
    const key = ref.key;
    const row = (pageRows ?? []).find((r: { page_key: string }) => r.page_key === key);
    const saved = (row?.layout_json as Record<string, unknown>) ?? {};
    const generated = isUngeneratedLayout(saved);
    return {
      pageKey: key,
      title: ref.title ?? null,
      isDraft: generated,
      // Upgraded on the way out, same as the editor does: a preview renders the
      // real components, so a table still saved in the four-prop shape would
      // otherwise be read by the legacy path on this screen and the new one in
      // the editor. One reader, one shape. See lib/portal/layout-upgrade.ts.
      layout: (generated
        ? buildPageLayout(key, businessContext, ownerName, locale, pageRefs)
        : upgradeLayout(saved)) as unknown as Data,
    };
  });

  // A head-only count: the rows themselves live on /portal/enquiries and the
  // home screen only needs to know whether any arrived.
  const { count: enquiryCount } = await supabase
    .from("site_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);

  return (
    <PortalHome
      locale={locale}
      accountEmail={user.email}
      paid={Boolean(project.paid)}
      style={project.style as StyleName}
      palette={(project.palette as string | null) ?? null}
      pages={pages}
      componentCount={REGISTERED_COMPONENTS.length}
      /**
       * THE SENTENCE FOLLOWS THE INTERFACE, and until 2026-08-25 it did not.
       *
       * This passed `analysis.summary` unconditionally -- the Chinese one --
       * so an owner on /en opened their portal to an English sidebar, an
       * English sub-line, and a 44px Chinese serif headline between them.
       * Reported with a screenshot: 「明明选择了英文 作为language 为什么还是有那么
       * 多华语字的呢」.
       *
       * `summary_en` has existed on every analysis since the schema was written
       * (lib/openai/analysis-schema.ts asks the model for both in one call) and
       * `get_my_business_context` has returned it since migration
       * 20260825020000. Nothing was missing; nothing read it.
       *
       * AND NO CROSS-LANGUAGE FALLBACK. `summary_en` is null on every analysis
       * generated before the column existed -- verified against the live table
       * on 2026-08-25, all three most recent rows -- and falling back to the
       * Chinese there would reproduce exactly the screenshot he sent. Null
       * instead, which makes PortalHome use its own translated headline: a
       * generic English sentence is a worse sentence and a better page than a
       * tailored one nobody on /en asked to read in Chinese.
       *
       * (Backfilling the old rows is a separate job -- founder-tasks task 8 --
       * because it means putting the model back over stored analyses, which is
       * a data write and not a rendering decision.)
       */
      summary={
        (locale === "zh"
          ? businessContext.analysis?.summary
          : businessContext.analysis?.summary_en) ?? null
      }
      businessName={displayBusinessName(businessContext)}
      /** null when the customer has not set one, so the settings dialog can
       *  tell "we are showing you a placeholder" apart from "this is your
       *  answer" and prompt accordingly. */
      savedBusinessName={businessContext.identity?.business_name ?? null}
      /**
       * Chinese only, on purpose.
       *
       * `get_my_business_context` returns `name_zh` and nothing else, so the
       * English headline read "Your 装修/承包商 system is built." — a mixed
       * language sentence that reads as a missing translation rather than as a
       * customer's own vocabulary.
       *
       * The industry name is dropped on `/en` instead of half-translated. That
       * is honest about a real limit: a customer's SYSTEM is generated in
       * Chinese throughout (page titles, column headings, sample records, the
       * AI's summary), because that is the language their business runs in.
       * Switching the interface to English does not, and should not silently
       * pretend to, translate their own data. Making the generated system
       * bilingual is a separate decision with a migration behind it
       * (`industries.name_en` exists; the RPC does not return it, and the
       * layouts have no locale dimension at all).
       */
      industryName={locale === "zh" ? (businessContext.industry?.name_zh ?? null) : null}
      /**
       * THE PUBLIC SITE IS NOT A PAGE LIKE THE OTHERS.
       *
       * 「客户的system页面 跟客户的landing pages跟website应该是要分开放的」 --
       * 2026-08-25, and it is a structural point rather than a layout one. The
       * five internal pages are the owner's own desk. 官网 is a different
       * object: it has an address, it is either live or it is not, and
       * strangers post into it. None of those three facts had anywhere to
       * appear on this screen, because the site was rendering as the sixth
       * tile in a grid whose cards can only say "draft / edited".
       */
      siteSlug={(project.site_slug as string | null) ?? null}
      sitePublished={Boolean(project.site_published)}
      enquiryCount={enquiryCount ?? 0}
    />
  );
}
