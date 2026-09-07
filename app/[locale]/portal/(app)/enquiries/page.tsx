import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { MarkEnquiriesRead } from "./mark-read";
import { EnquiryList } from "./enquiry-list";
import { InboxCount } from "./inbox-count";
import { PageBar } from "../page-bar";
import { PageBody, Section } from "../section";
import { loadWorkspace } from "@/lib/portal/workspace";
import { MODULE_BY_KEY, moduleLabel } from "@/lib/portal/module-catalog";

/**
 * 官网来的询价 — the other end of the arrow.
 *
 * WHY IT IS A PAGE IN FORMAE'S OWN CHROME AND NOT A BLOCK IN THE CUSTOMER'S
 * SYSTEM. The finished system, the one a build team delivers after the
 * RM 5,000, puts these rows straight into the business's own 报价单 / 预约 /
 * 订单 page -- which is what the line under the form promises and what
 * `lands_in` records against every row. That page is a Puck layout: it is the
 * customer's to rearrange, and wiring live database rows into a block they can
 * delete is a different piece of work with a different failure mode.
 *
 * So the inbox lands HERE first: real enquiries, visible the moment they
 * arrive, in the shell the owner is already signed into. It is the honest
 * intermediate -- the arrow is connected and the owner can see it fire, without
 * pretending the generated preview is already the finished system.
 *
 * 🔴 AND SINCE 20260901050000 IT NO LONGER STOPS HERE. 「开一张单」 puts the
 * enquiry on his own 报价单 page as a real row with its own document number,
 * and puts the person in his 客户 list -- which is the whole sentence the
 * product has been making since 8-25, finally finished.
 *
 * ⚠️ THE COPY ON THIS PAGE HAD TO CHANGE WITH IT. It said 「Once the system is
 * delivered these go straight into your own page」 and 「After delivery this
 * becomes a row in: quotations」 -- both true when the arrow stopped here, both
 * false the moment the button existed. A page describing a limit the product
 * no longer has is the same defect as a control that does not work, seen from
 * the other side.
 *
 * ── 🔴 2026-09-01：这一页第一次讲 portal 自己的话 ───────────────────────────
 * 老板：`我们要每一个操作跟页面都是要好看的UI设计跟流畅的使用体验`。
 * 量出来的不是「不好看」，是**这一页不属於这个产品**：
 *
 *     顶栏 `PageBar` .............. 9 个 surface 在用，**这一页没有**
 *     段落语言 `Section`/`PageBody`  写於 8-21，**零个消费端**
 *     页面边距 ................... portal 里有 **8 种**，`PAGE_PADDING` 只有 1 个人用
 *
 * `(app)/section.tsx` 的档头自己就写着这件事的病因（「every portal screen then
 * invented its own heading」）—— 它写对了，然后没有人用它。
 * 这一页是第一个改成用它的。
 */
export default async function EnquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("portal");
  const supabase = await createSessionSupabaseClient();
  const { data } = await supabase.rpc("my_site_enquiries");
  const rows = (data ?? []) as {
    id: string;
    name: string;
    contact: string;
    answers: Record<string, string>;
    lands_in: string;
    status: string;
    created_at: string;
    converted_record_id: string | null;
    converted_at: string | null;
  }[];

  /* Counted from what this render is showing, so the marker only fires when
     there is something to mark. */
  const unread = rows.filter((r) => r.status === "new").length;

  /* WHERE A QUOTATION WOULD GO, ASKED ONCE FOR THE WHOLE PAGE.

     The button is only honest if there is a page for it to land on: a business
     whose system has no 报价单 · 订单 · 工程 has nowhere to put a job, and
     drawing the button there would be drawing a control that cannot work.
     Asked by CALLING the same function the button calls, rather than by
     re-deciding it here off the module catalogue. A second copy of the rule
     would be right today and drift -- which is how this repository has shipped
     the same defect six times. Null means there is nowhere. */
  const workspace = await loadWorkspace();

  /* ⚠️ ASKED PER `lands_in`, NOT ONCE. The line under each enquiry used to
     print `lands_in` raw, and `lands_in` defaults to 'customers' -- which is a
     NAME LIST, not a page a job can live on. So the screen said 「Opens a job
     on: customers」 while the button was about to open it on 报价单. A label
     that names a different destination from the button beside it is the same
     defect as a control that does not work, and it is harder to notice.

     One call per distinct value (there are one or two), so the label and the
     button resolve through the same function and cannot disagree. */
  const wanted = [...new Set(rows.map((r) => r.lands_in))];
  const landings = new Map<string, string | null>();
  if (workspace) {
    for (const key of wanted.length ? wanted : [null]) {
      const { data } = await supabase.rpc("enquiry_target", {
        in_project_id: workspace.projectId,
        in_wanted: null,
        in_lands_in: key,
      });
      landings.set(key ?? "", (data as string | null) ?? null);
    }
  }
  /* If nothing resolves for any of them, this business has no page a job can
     go on -- the button is replaced by the reason. */
  const hasPipeline = [...landings.values()].some(Boolean);

  /* The rows a converted enquiry points at, so the link can carry the document
     number and the page it lives on. One query for the page rather than one
     per row. */
  const doneIds = rows
    .map((r) => r.converted_record_id)
    .filter(Boolean) as string[];
  const { data: madeRows } = doneIds.length
    ? await supabase
        .from("pipeline_records")
        .select("id, module_key, doc_no")
        .in("id", doneIds)
    : { data: [] };
  const madeBy = new Map(
    (
      (madeRows as
        { id: string; module_key: string; doc_no: string }[] | null) ?? []
    ).map((r) => [r.id, r]),
  );

  /* 「新的」有几封 —— 从这一次渲染看到的东西数出来，而且要在 mark-read 跑之前。 */
  const shaped = rows.map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    answers: r.answers,
    status: r.status,
    created_at: r.created_at,
    /* 那一页自己的名字，不是 key。`quotations` 是工程师的词，报价单才是他的。 */
    landsInLabel: (() => {
      const key = landings.get(r.lands_in) ?? r.lands_in;
      const m = MODULE_BY_KEY[key];
      const page = m ? moduleLabel(m, locale === "zh" ? "zh" : "en") : key;
      return t("enquiriesLandsIn", { page });
    })(),
    converted:
      r.converted_record_id && madeBy.has(r.converted_record_id)
        ? {
            recordId: r.converted_record_id,
            moduleKey: madeBy.get(r.converted_record_id)!.module_key,
            docNo: madeBy.get(r.converted_record_id)!.doc_no,
          }
        : null,
  }));

  return (
    <>
      <MarkEnquiriesRead unread={unread} />
      {/* 别的 portal 页都有这一条，这一页本来没有 —— 一个产品里有一页不长得
          像那个产品，比十页都平庸更明显。 */}
      <PageBar
        title={t("enquiries")}
        subtitle={
          rows.length ? (
            <InboxCount unread={unread} total={rows.length} />
          ) : undefined
        }
      />
      <PageBody>
        <Section
          label={t("enquiriesInbox")}
          count={rows.length ? rows.length : undefined}
        >
          <p className="mb-6 max-w-[62ch] [font-size:var(--text-sm)] [color:var(--color-paper-dim)]">
            {t("enquiriesBlurb")}
          </p>
          {rows.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed p-8 text-center [font-size:var(--text-sm)] [color:var(--color-paper-dim)] [border-color:var(--color-ink-800)]">
              {t("enquiriesEmpty")}
            </p>
          ) : (
            <EnquiryList
              rows={shaped}
              locale={locale}
              hasPipeline={hasPipeline}
            />
          )}
        </Section>
      </PageBody>
    </>
  );
}
