import { notFound, redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { firstRecordTable, type PuckLayout } from "@/lib/portal/layout-ops";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import {
  buildPageLayout,
  displayOwnerName,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  systemLangOf,
  tradeLabels,
  stagesForModule,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { MODULE_BY_KEY, type ModuleShape } from "@/lib/portal/module-catalog";
import { isLiveShape } from "@/lib/portal/shape-state";
import type { TableColumn } from "@/lib/portal/table-model";
import { canOpenModule, loadWorkspace, type WorkspaceRole } from "@/lib/portal/workspace";

/**
 * Everything 「加一单」 and 「改这一单」 both need, loaded once.
 *
 * ── WHY IT IS SHARED AND NOT COPIED ───────────────────────────────────────
 *
 * The two pages ask the same eight questions -- is this shape live, does THIS
 * business have this page, what are its columns, what are its own stage words,
 * who can it be attached to, what style is it wearing. Two copies would answer
 * them the same way today and differently in a month, which is the defect this
 * repo has shipped more times than any other.
 *
 * ⚠️ It calls notFound()/redirect() itself. That is deliberate: every one of
 * those exits is a rule about who may see the page, and a caller that has to
 * remember to check them is a caller that will forget one.
 */

export type RecordPageContext = {
  locale: string;
  pageKey: string;
  shape: ModuleShape;
  isDirectory: boolean;
  projectId: string;
  style: StyleName;
  palette: string | null;
  lang: "zh" | "en";
  /** This page's own table columns, which is what the form's boxes are made
   *  of -- a workshop that added 「车牌号」 gets a box for it. */
  columns: TableColumn[];
  /** This business's own workflow words. Only a pipeline has them. */
  stages: string[];
  /** 这一行是什么生意，给分期付款表建议惯例用。 */
  trade: string | null;
  /** Who a record can be attached to. Empty on a directory page, which is
   *  where a party is created rather than chosen. */
  parties: { id: string; name: string }[];
  /** The page's own title, in the system's language. */
  title: string;
  backHref: string;
  /** Owner or 师傅. Carried so the form can say what it will not offer. */
  role: WorkspaceRole;
};

export async function loadRecordPage(
  locale: string,
  pageKey: string,
): Promise<RecordPageContext> {
  /* Only the shapes that hold real rows. 库存 and 对账 draw a table too, and
     they are still samples -- offering a form there would be a control that
     writes nowhere, which this repo has shipped enough times. */
  const shape = MODULE_BY_KEY[pageKey]?.shape;
  if (!shape || !isLiveShape(shape)) notFound();
  const isDirectory = shape === "directory";

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();

  /* WHICH BUSINESS, NOT WHOSE ACCOUNT -- see lib/portal/workspace.ts. Writing
     down a job from the site is the whole reason a supervisor has a login, so
     this is the one form he must be able to reach. */
  const workspace = await loadWorkspace();
  const { data: project } = workspace
    ? await supabase
        .from("projects")
        .select("id, style, palette, layout")
        .eq("id", workspace.projectId)
        .single()
    : { data: null };
  if (!project || !workspace) redirect("/login");

  /* And 收款 · 开销 · 佣金 are refused here too, not only on the page they are
     reached from. `add_ledger_entry` would refuse him at the database anyway;
     a form that collects an amount and then cannot save it is worse than no
     form, because he will have typed it. */
  if (!canOpenModule(workspace.role, pageKey)) notFound();

  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, sort_order, layout_json")
    .eq("project_id", project.id);

  const page = (pageRows ?? []).find((r: { page_key: string }) => r.page_key === pageKey);
  /* Not 「this module exists in the catalogue」 -- 「this business has it」. A
     restaurant with no quotations page must not be given a form for one. */
  if (!page) notFound();

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  const lang = systemLangOf(businessContext);

  const savedLayout = (page.layout_json as Record<string, unknown>) ?? {};
  const pageRefs = sortPages(
    (pageRows ?? []).map(
      (r: { page_key: string; title: string | null; sort_order: number | null }) => ({
        key: r.page_key,
        title: r.title,
        sortOrder: r.sort_order,
      }),
    ),
  );

  const layout = (
    isUngeneratedLayout(savedLayout)
      ? buildPageLayout(
          pageKey as PageKey,
          businessContext,
          displayOwnerName(businessContext, user.email?.split("@")[0] || "我"),
          locale,
          pageRefs,
          project.style as StyleName,
          (project.layout as string | null) ?? null,
        )
      : upgradeLayout(savedLayout, lang)
  ) as unknown as PuckLayout;

  const table = firstRecordTable(layout);
  /* No table on the page means nothing to write into. The owner removed it,
     which is allowed; a form writing into a table he cannot see is not. */
  if (!table || !table.columns.length) notFound();

  const { data: parties } = isDirectory
    ? { data: null }
    : await supabase
        .from("directory_entries")
        .select("id, name")
        .eq("project_id", project.id)
        /* WHICH SIDE OF THE BOOK. 进货单 buys, so its picker offers suppliers
           -- the same rule directory_side() applies in the database, and the
           reason it exists: the same person can be both, and a purchase order
           attached to the CUSTOMER of that name files the money against the
           wrong side of the business. */
        .eq("module_key", pageKey === "purchases" ? "suppliers" : "customers")
        .is("archived_at", null)
        .order("name")
        .limit(500);

  const labels = tradeLabels(businessContext, pageRefs);

  return {
    locale,
    pageKey,
    shape,
    isDirectory,
    projectId: project.id as string,
    style: project.style as StyleName,
    palette: (project.palette as string | null) ?? null,
    lang: lang === "en" ? "en" : "zh",
    columns: table.columns,
    /* 进货单's stages are its own -- see stagesForModule. The form offers
       what the page actually shows. */
    stages: shape === "pipeline" ? stagesForModule(businessContext, pageKey) : [],
    parties: (parties as { id: string; name: string }[] | null) ?? [],
    title: pageLabel({ key: pageKey, title: page.title ?? null }, labels, lang),
    backHref: `/${locale}/portal/${pageKey}`,
    role: workspace.role,
    /* 这一行是什么生意 —— 分期付款表拿它去建议「订金三成 · 动工四成 ·
       完工三成」，而那是一颗他要按的按钮，不是一个预设。 */
    trade: businessContext.industry?.slug ?? null,
  };
}
