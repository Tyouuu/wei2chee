import { redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { PortalHome } from "../home-client";
import { REGISTERED_COMPONENTS } from "@/lib/portal/layout-ops";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import { defaultRegister } from "@/lib/portal/default-register";
import {
  canOpenModule,
  hideMoneyFromRail,
  loadWorkspace,
} from "@/lib/portal/workspace";
import {
  buildPageLayout,
  displayBusinessName,
  displayOwnerName,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  systemLangOf,
  tradeLabels,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";
import { productHome, systemSurfaceOf } from "@/lib/portal/system-surface";

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

  /* WHICH BUSINESS, NOT WHOSE ACCOUNT -- see lib/portal/workspace.ts. This is
     the first screen a supervisor lands on, so it is the first place the old
     `account_id = auth.uid()` would have put him in an empty shell. */
  const workspace = await loadWorkspace();
  const { data: project } = workspace
    ? await supabase
        .from("projects")
        .select(
          "id, style, palette, paid, stage, stage_changed_at, site_slug, site_published, layout",
        )
        .eq("id", workspace.projectId)
        .single()
    : { data: null };

  if (!project || !workspace) redirect("/login");
  /* 🔴 2026-09-08：这里本来是 `if (!project.style) redirect("/portal/style-select")`。
     老板看到那一页：「沒有這個system style呢 這個已經不要了 舊概念了」——
     而 2026-09-04 之后工作台只有一套，那一页的预览画的正好是不会跟着变的那一半。
     照他这一行给一套（资料库 2026-08-27 就填好了），他不用先被问一次。
     见 lib/portal/default-register.ts。 */
  const register = await defaultRegister(supabase, project.style);

  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, sort_order, layout_json")
    .eq("project_id", project.id);

  // PageRefs, not keys: a custom page carries the customer's own title, and
  // every label in the rail and on this screen comes from it.
  const pageRefs = sortPages(
    (pageRows ?? []).map(
      (r: {
        page_key: string;
        title: string | null;
        sort_order: number | null;
      }) => ({
        key: r.page_key,
        title: r.title,
        sortOrder: r.sort_order,
      }),
    ),
  );

  // One call, not one per page: `get_my_business_context` is `security definer`
  // and resolves the lead from auth.uid() internally, so there is no id to pass
  // and nothing here can reach another customer's lead.
  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  /* 🔴 沙龙帐号的平台首页是新设计（任务 425）。老板：`平台方还是用着旧版的设计`。
     旧的首页画的是旧页面的缩略图 ＋ 旧模块库，对沙龙不成立了 —— 直接转到新版的
     Setup & Delivery（交付到哪一步 ＋ 进系统的入口 ＋ 官网 / 需求书）。
     别的行业一个字不动。 */
  if (systemSurfaceOf(businessContext) === "salon") {
    redirect(`/${locale}/salon-preview/setup`);
  }
  // The account chip answers "who am I signed in as", so it wants the person's
  // name. Until they set one in settings, the email's local part is the least
  // bad stand-in -- better than the full address, which would put a customer's
  // email into every screenshot of their own system.
  const ownerName = displayOwnerName(
    businessContext,
    user.email?.split("@")[0] || "我",
  );

  /* 🔴 The money pages are not on his home screen either.

     Filtered here rather than only in the rail because this screen draws a
     LIVE MINIATURE of each page -- a supervisor would get a picture of 收款
     with every row missing, which says something false about the business
     rather than nothing about his permissions. By shape, so a money module
     catalogued later is covered without anybody remembering. */
  const visibleRefs = pageRefs.filter((ref) =>
    canOpenModule(workspace.role, ref.key),
  );

  const pages = visibleRefs.map((ref) => {
    const key = ref.key;
    const row = (pageRows ?? []).find(
      (r: { page_key: string }) => r.page_key === key,
    );
    const saved = (row?.layout_json as Record<string, unknown>) ?? {};
    const generated = isUngeneratedLayout(saved);
    return {
      pageKey: key,
      title: ref.title ?? null,
      /* Resolved HERE, with the same call the rail uses, because the home
         screen was resolving it a second way: a hand-kept BUILT_IN_PAGE_KEYS
         array of seven names, against a catalogue of seventeen. Ten modules —
         commission, staff, inventory and the rest — fell through it to
         「New page」 the moment they had no stored title, which is exactly the
         state 20260826030000 intended every built-in to be in. A second list is
         how the register list, the palette list and the page list have each
         gone stale in turn; the catalogue is the one that cannot. */
      label: pageLabel(
        ref,
        tradeLabels(businessContext, pageRefs),
        systemLangOf(businessContext),
      ),
      isDraft: generated,
      // Upgraded on the way out, same as the editor does: a preview renders the
      // real components, so a table still saved in the four-prop shape would
      // otherwise be read by the legacy path on this screen and the new one in
      // the editor. One reader, one shape. See lib/portal/layout-upgrade.ts.
      /* ⚠️ The miniature carries the customer's OWN rail inside it, and that
         rail lists every page including the money ones. It is `inert`, so it
         is a photograph of a rail rather than a rail -- but a supervisor
         looking at a picture of 收款 is still being shown a part of the
         business he was told he cannot see. Filtered for the same reason the
         real one is. */
      layout: hideMoneyFromRail(
        (generated
          ? buildPageLayout(
              key,
              businessContext,
              ownerName,
              locale,
              pageRefs,
              register as string,
              (project.layout as string | null) ?? null,
            )
          : upgradeLayout(
              saved,
              systemLangOf(businessContext),
            )) as unknown as Data,
        workspace.role,
      ),
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
      isOwner={workspace.isOwner}
      /* `stage` is where they are in the BUSINESS -- designing, quoted, paid,
         building, live -- and it has been in this table, and readable by its
         owner, since 20260821020000. Nothing selected it, so the screen that
         had the answer never said it. */
      stage={(project.stage as string | null) ?? "designing"}
      stageChangedAt={(project.stage_changed_at as string | null) ?? null}
      style={register as StyleName}
      palette={(project.palette as string | null) ?? null}
      pages={pages}
      componentCount={REGISTERED_COMPONENTS.length}
      productHref={
        systemSurfaceOf(businessContext) === "salon" ? productHome(locale) : null
      }
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
      industryName={
        locale === "zh" ? (businessContext.industry?.name_zh ?? null) : null
      }
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
