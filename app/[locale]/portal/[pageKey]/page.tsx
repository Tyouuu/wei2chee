import { notFound, redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { PortalEditor } from "./editor-client";
import type { Data } from "@puckeditor/core";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import { applyLayoutOps, type PuckLayout } from "@/lib/portal/layout-ops";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { ALL_LANDING_BY_KEY } from "@/lib/templates/all-landings";
import {
  landingContentFor,
  PAGE_KEYS,
  buildPageLayout,
  displayOwnerName,
  isBuiltInPage,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  systemLangOf,
  tradeLabels,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";

/** Used when an account has no lead, so `industry.labels` is absent -- the same
 *  generic vocabulary industry-template.ts falls back to. */

export default async function PortalEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; pageKey: string }>;
  searchParams: Promise<{ add?: string; tpl?: string }>;
}) {
  const { locale, pageKey } = await params;
  const { add, tpl } = await searchParams;
  // Cheap shape check only. The REAL check is against the pages this account
  // actually has, further down -- a business whose trade has no quotations
  // must 404 on /portal/quotations rather than render an empty one.
  // Shape check only, and it now has to admit custom keys -- the real check is
  // still `if (!page) notFound()` further down, against the pages this account
  // actually has. Mirrors the database's own constraint (migration
  // 20260820200000) rather than restating a different rule.
  if (!isBuiltInPage(pageKey) && !/^custom_[a-z0-9]{8,32}$/.test(pageKey))
    notFound();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Session-aware client, not the service-role client: RLS's
  // `projects_select_own`/`project_pages_select_own` policies are the real
  // enforcement for both reads below, with the `.eq(...)` filters kept for
  // explicitness -- the filters alone aren't a backstop against a future
  // edit dropping or mistyping one.
  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style, palette, paid, site_slug, site_published, corners, layout")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  // Every page this account has, in its own order. Pages are now provisioned
  // per industry (migration 20260820160000), so this is the only honest source
  // for both "does this page exist for this customer" and the editor's nav --
  // a hardcoded five-page list would 404 a salon's 预约 page and offer a
  // contractor's 报价单 to a restaurant.
  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, sort_order, layout_json")
    .eq("project_id", project.id);

  const pageRefs = sortPages(
    (pageRows ?? []).map((r: { page_key: string; title: string | null; sort_order: number | null }) => ({
      key: r.page_key,
      title: r.title,
      sortOrder: r.sort_order,
    })),
  );
  const page = (pageRows ?? []).find(
    (r: { page_key: string }) => r.page_key === pageKey,
  );
  if (!page) notFound();

  const savedLayout = (page.layout_json as Record<string, unknown>) ?? {};

  // THE FIX for the journey's worst break (docs/formae-product-direction.md
  // sections 2-4): the signup trigger creates all five project_pages rows with
  // `layout_json = '{}'`, so before this a customer who had just spent the
  // acquisition flow answering questions about their business landed on an
  // empty canvas, with every one of those answers discarded.
  //
  // A page that has never been written to is instead generated NOW, from the
  // customer's own industry, questionnaire and AI analysis. Nothing is
  // persisted here -- generation is a pure read-side default, so it costs no
  // write path, respects the paid gate exactly as before (an unpaid customer
  // can explore and edit their generated system, they just cannot save it),
  // and re-runs harmlessly on every load until their first save.
  // `get_my_business_context` (20260820120000) is security definer and resolves
  // the lead from auth.uid() internally -- there is no id to pass and therefore
  // no way for this call to reach another customer's lead. Returns null for an
  // account that signed up without ever answering the questionnaire;
  // buildPageLayout treats that as "no context" and still produces a complete
  // generic system rather than a blank page.
  //
  // Fetched unconditionally, where it used to be fetched only when a page had
  // to be generated: the page tabs now carry the trade's own vocabulary
  // ("客户" vs "病人") and a customer's own titles for pages they added, so the
  // labels need it on every load, not only on a first visit.
  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};

  // Brought up to the current component shapes BEFORE Puck sees it. Puck's
  // fields panel edits exactly the props it is handed, so a table left in the
  // legacy four-prop shape would show the customer both the new column editor
  // and a dead row editor -- see lib/portal/layout-upgrade.ts.
  let initialData = upgradeLayout(savedLayout, systemLangOf(businessContext));
  if (isUngeneratedLayout(savedLayout)) {
    initialData = buildPageLayout(
      pageKey,
      businessContext,
      // The account chip only -- the rail's BRAND label now comes from
      // `projects.business_name` inside buildPageLayout. This is the person,
      // and the email's local part is the stand-in until they set a name.
      displayOwnerName(businessContext, user.email?.split("@")[0] || "我"),
      locale,
      pageRefs,
      // THE REGISTER CHOOSES THE PAGE'S BLOCKS, not only their paint. Generation
      // is a read-side default until the customer's first save, so the style is
      // known right here -- which is what lets 换风格 re-lay-out the page on the
      // same click that repaints it. See dashboardComposition().
      project.style,
      // 排法 — a NAMED arrangement that overrides the register's own, so an
      // owner can keep 柔和's colours and read 台账's table-first page.
      (project.layout as string | null) ?? null,
    ) as unknown as Record<string, unknown>;
  }

  // 「去用它」 from the component library. Applied through the SAME
  // add_component operation the AI assistant emits, so a block arrives in the
  // main column exactly as a drag would: unsaved, on the undo stack, behind the
  // same paid gate. The name is checked against the live registry inside
  // applyLayoutOps, so a hand-typed `?add=DropTable` is a no-op rather than an
  // empty block on someone's page.
  // 「换成这个」 from 模板库's 官网版面 gallery. Replaces the whole page rather
  // than adding to it -- that is what choosing a layout means -- and only for
  // the website page, so a hand-typed ?tpl= on 收款 does nothing.
  //
  // NOT written to the database here. It arrives in the editor as an UNSAVED
  // change, on the undo stack, behind the same paid gate as every other edit:
  // a customer who presses a template and does not like it presses 撤销, and a
  // free customer can try all nine without a server-side save existing at all.
  const landing =
    pageKey === "website" && tpl ? ALL_LANDING_BY_KEY[tpl] : undefined;
  if (landing) {
    initialData = {
      root: {},
      content: landing.build(landingContentFor(businessContext, pageRefs)),
    } as unknown as Record<string, unknown>;
  }

  if (add) {
    initialData = applyLayoutOps(initialData as unknown as PuckLayout, [
      { op: "add_component", component: add, after_id: null, title: null },
    ]).layout as unknown as Record<string, unknown>;
  }

  /*
    EVERY PAGE, FOR THE STYLE TILES.

    「做成可以preview 好像一个video 这样的 客户就可以看到dashboard页面啊 其他的页面啊
    然后客户就会去选」. A register is a decision about a SYSTEM, and a tile showing
    one page can only answer "what does this page look like" -- so the tile
    plays through them.

    Built exactly as `initialData` is a few lines below, including the
    generate-on-read fallback, so a page the customer has never opened still
    appears in the reel rather than as a gap. Capped at four: the reel is a
    glance, not the whole system, and seventeen tiles times seven pages is a
    hundred and nineteen scaled page renders in one sheet.
  */
  const previewPages = pageRefs.slice(0, 4).map((ref) => {
    const row = (pageRows ?? []).find(
      (r: { page_key: string }) => r.page_key === ref.key,
    );
    const saved = (row?.layout_json as Record<string, unknown>) ?? {};
    const data = isUngeneratedLayout(saved)
      ? (buildPageLayout(
          ref.key as PageKey,
          businessContext,
          displayOwnerName(businessContext, user.email?.split("@")[0] || "我"),
          locale,
          pageRefs,
          project.style,
          (project.layout as string | null) ?? null,
        ) as unknown as Record<string, unknown>)
      : upgradeLayout(saved, systemLangOf(businessContext));
    return {
      key: ref.key,
      label: pageLabel(ref, tradeLabels(businessContext, pageRefs), systemLangOf(businessContext)),
      data,
    };
  });

  return (
    <PortalEditor
      pageKey={pageKey}
      /** Set when the layout was seeded from ?add=, so the editor can strip the
       *  parameter — leaving it in the URL would re-add the block on every
       *  reload and on every back-navigation. */
      seededComponent={add ?? null}
      /** Set when ?tpl= replaced the layout, so the editor strips the
       *  parameter and marks the page unsaved -- same reason as ?add=. */
      seededTemplate={landing ? landing.key : null}
      projectId={project.id}
      accountEmail={user.email}
      /** projects.paid (Task 1) -- save_project_page raises "payment required"
       * server-side for an unpaid project (the real enforcement), but the
       * paywall interstitial is shown client-side off this prop so an unpaid
       * customer sees a purpose-built CTA instead of a raw error. */
      paid={Boolean(project.paid)}
      initialData={initialData}
      /** True only when the customer has never saved this page, i.e. what they
       * are looking at is the generated draft rather than their own work. The
       * editor uses it to say so, which is the difference between "the system
       * guessed this for you, change anything" and a customer assuming these
       * are real records. */
      isGeneratedDraft={isUngeneratedLayout(savedLayout)}
      locale={locale}
      navPages={pageRefs.map((ref) => ({
        key: ref.key,
        label: pageLabel(
          ref,
          tradeLabels(businessContext, pageRefs),
          systemLangOf(businessContext),
        ),
        // The customer's own name, kept apart from the resolved label: 页面's
        // rename box shows the label as a PLACEHOLDER and this as the value, so
        // clearing it visibly means "go back to the trade's own word".
        title: ref.title ?? null,
      }))}
      /** The customer's own chosen style (projects.style, Task 3) -- applies to
       * canvas CONTENT only. Chrome stays Ledger regardless, per Task 5's own
       * reviewed design. */
      style={project.style as StyleName}
      palette={(project.palette as string | null) ?? null}
      corners={Number(project.corners ?? 1)}
      layout={(project.layout as string | null) ?? null}
      previewPages={previewPages as unknown as { key: string; label: string; data: Data }[]}
      systemLang={systemLangOf(businessContext)}
      /* The library's opening guess. See trade-context.tsx for why it travels
         as a context rather than through the Puck config. */
      trade={businessContext.industry?.slug ?? null}
      /** The 官网's public address and whether it answers -- read here rather
       *  than fetched again in the editor, because the same projects row
       *  already supplies style and palette and a second query would be a
       *  second source of truth. Both are meaningless on the other pages; the
       *  editor mounts the control for `website` only. */
      siteSlug={(project.site_slug as string | null) ?? null}
      sitePublished={Boolean(project.site_published)}
    />
  );
}
