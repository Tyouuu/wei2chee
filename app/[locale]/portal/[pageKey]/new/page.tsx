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
  workflowStages,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { MODULE_BY_KEY } from "@/lib/portal/module-catalog";
import { NewRecordForm } from "./new-record-form";
import { StyleScope } from "@/design-system/editor/style-scope";

/**
 * 加一单 — the page behind the button in every record page's header.
 *
 * ── WHY A PAGE AND NOT A DIALOG IN THE EDITOR ─────────────────────────────
 *
 * The editor's canvas is rendered in a dozen places that have no session: the
 * style gallery, the landing page's showroom, hundreds of live thumbnails and
 * the printed page. That is the reason rows arrive by projection rather than
 * by a component that fetches (see lib/portal/live-rows.ts). A control that
 * writes to a database cannot live inside a tree drawn in all of those places
 * -- so the header carries a LINK, which is inert wherever there is nothing
 * behind it, and the writing happens here.
 *
 * ── THE FIELDS ARE THIS BUSINESS'S OWN COLUMNS ────────────────────────────
 *
 * Read off the page the owner is looking at, so a workshop that added 「车牌
 * 号」 gets a box for it and nobody writes a form per trade. A page never
 * saved is generated exactly as the editor generates it, rather than being
 * approximated here -- a form whose columns disagree with the table it writes
 * into is worse than no form.
 */

const COPY = {
  zh: {
    heading: (page: string) => `加一单 · ${page}`,
    lede: "填好按保存，它就会出现在这一页的表格里。",
    save: "保存",
    saving: "保存中…",
    cancel: "取消",
    required: "第一栏要填，不然这一单看不出是什么。",
    failed: "没有存进去",
    choose: "选一个",
  },
  en: {
    heading: (page: string) => `New entry · ${page}`,
    lede: "Fill this in and save. It appears in the table on this page.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    required: "The first field is what this entry is about — it cannot be blank.",
    failed: "Not saved",
    choose: "Choose one",
  },
} as const;

export default async function NewRecordPage({
  params,
}: {
  params: Promise<{ locale: string; pageKey: string }>;
}) {
  const { locale, pageKey } = await params;

  /* Only the shapes that hold real rows. 客户 and 库存 draw a table too, and
     they are still samples -- offering 「加一单」 there would be a button that
     writes nowhere, which this repo has shipped enough times. */
  const shape = MODULE_BY_KEY[pageKey]?.shape;
  const isLedger = shape === "ledger";
  if (shape !== "pipeline" && !isLedger) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style, palette, layout")
    .eq("account_id", user.id)
    .single();
  if (!project) redirect("/login");

  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, sort_order, layout_json")
    .eq("project_id", project.id);

  const page = (pageRows ?? []).find(
    (r: { page_key: string }) => r.page_key === pageKey,
  );
  /* Not 「this module exists in the catalogue」 -- 「this business has it」. A
     restaurant with no quotations page must not be given a form for one. */
  if (!page) notFound();

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  const lang = systemLangOf(businessContext);

  const savedLayout = (page.layout_json as Record<string, unknown>) ?? {};
  const pageRefs = sortPages(
    (pageRows ?? []).map((r: { page_key: string; title: string | null; sort_order: number | null }) => ({
      key: r.page_key,
      title: r.title,
      sortOrder: r.sort_order,
    })),
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
  /* No table on the page means nothing to add a row to. The owner removed it,
     which is allowed; a form writing into a table he cannot see is not. */
  if (!table || !table.columns.length) notFound();

  const copy = COPY[lang === "en" ? "en" : "zh"];
  const labels = tradeLabels(businessContext, pageRefs);
  const title = pageLabel({ key: pageKey, title: page.title ?? null }, labels, lang);
  const backHref = `/${locale}/portal/${pageKey}`;

  return (
    /* THE CUSTOMER'S OWN STYLE, NOT OURS.

       The first version wore `chrome` -- Formae's dark shell. On a red-and-
       cream system it read as a different product entirely, which is exactly
       the 四不像 of 任务 20. This form is part of HIS system: the same page he
       just left, one click away, has to look like it.

       Found by looking at the screenshot. Every check passed first. */
    <StyleScope
      register={project.style as StyleName}
      palette={(project.palette as string | null) ?? null}
      className="min-h-screen"
    >
      <main className="mx-auto w-full max-w-[560px] px-6 py-10">
      <h1 className="ds-display [font-size:var(--text-title)] tracking-[var(--tracking-title)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
        {copy.heading(title)}
      </h1>
      <p className="mt-1 mb-7 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">{copy.lede}</p>
      <NewRecordForm
        projectId={project.id as string}
        moduleKey={pageKey}
        isLedger={isLedger}
        columns={table.columns}
        /* This business's own words for its stages, not a vocabulary we
           invented -- the same list add_pipeline_record falls back to. */
        stages={isLedger ? [] : workflowStages(businessContext)}
        backHref={backHref}
        /* Only the strings. `heading` is a function, and a function cannot
           cross from a server component to a client one -- it renders as a 500
           the first time the page is opened, which is exactly how this was
           found: by opening it. Passing the whole object type-checked fine,
           because an excess property on a variable is not an excess property. */
        copy={{
          save: copy.save,
          saving: copy.saving,
          cancel: copy.cancel,
          required: copy.required,
          failed: copy.failed,
          choose: copy.choose,
        }}
      />
      </main>
    </StyleScope>
  );
}
