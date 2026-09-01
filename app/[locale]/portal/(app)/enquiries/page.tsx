import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { MarkEnquiriesRead } from "./mark-read";
import { ConvertEnquiry } from "./convert";
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
  const doneIds = rows.map((r) => r.converted_record_id).filter(Boolean) as string[];
  const { data: madeRows } = doneIds.length
    ? await supabase
        .from("pipeline_records")
        .select("id, module_key, doc_no")
        .in("id", doneIds)
    : { data: [] };
  const madeBy = new Map(
    ((madeRows as { id: string; module_key: string; doc_no: string }[] | null) ?? []).map((r) => [
      r.id,
      r,
    ]),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <MarkEnquiriesRead unread={unread} />
      <h1 className="[font-size:var(--text-title)] font-semibold">
        {t("enquiries")}
      </h1>
      <p className="mt-2 max-w-[62ch] text-sm opacity-70">{t("enquiriesBlurb")}</p>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-sm opacity-60">
          {t("enquiriesEmpty")}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-medium">{r.name}</span>
                <a
                  className="text-sm underline underline-offset-2"
                  href={`https://wa.me/${r.contact.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.contact}
                </a>
                <span className="ml-auto text-xs tabular-nums opacity-60">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              {Object.entries(r.answers ?? {}).map(([k, v]) => (
                <p key={k} className="mt-2 text-sm opacity-80">
                  <span className="opacity-60">{k}：</span>
                  {String(v)}
                </p>
              ))}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-xs opacity-55">
                  {t("enquiriesLandsIn", {
                    /* The page's own name in the language the system speaks,
                       not the key. 「Opens a job on: quotations」 is a
                       developer's word for 报价单. */
                    page: (() => {
                      const key = landings.get(r.lands_in) ?? r.lands_in;
                      const m = MODULE_BY_KEY[key];
                      return m ? moduleLabel(m, locale === "zh" ? "zh" : "en") : key;
                    })(),
                  })}
                </p>
                <span className="ml-auto">
                  {hasPipeline ? (
                    <ConvertEnquiry
                      enquiryId={r.id}
                      locale={locale}
                      converted={
                        /* Only when the row it points at is still there. A
                           quotation he deleted leaves `converted_at` set and
                           the record gone -- the enquiry keeps its history and
                           the button stops offering to open nothing. */
                        r.converted_record_id && madeBy.has(r.converted_record_id)
                          ? {
                              recordId: r.converted_record_id,
                              moduleKey: madeBy.get(r.converted_record_id)!.module_key,
                              docNo: madeBy.get(r.converted_record_id)!.doc_no,
                            }
                          : null
                      }
                    />
                  ) : (
                    <span className="text-xs opacity-55">{t("enquiryNoPipeline")}</span>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
