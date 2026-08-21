import { notFound, redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { CustomerDetail } from "./customer-detail";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import { buildSystemSpec, specToText } from "@/lib/portal/spec-outline";
import type { PuckLayout } from "@/lib/portal/layout-ops";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import {
  buildPageLayout,
  displayOwnerName,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  type BusinessContext,
} from "@/lib/templates/industry-template";

/**
 * One customer, everything about them.
 *
 * THIS PAGE IS THE FIX FOR THE BROKEN REVENUE STEP. A customer presses
 * 「交给我们建」 and the founder receives a WhatsApp message carrying an email
 * and a project id — and then could not see what they had designed. `/portal/spec`
 * resolves the project from `auth.uid()` and RLS restricts `project_pages` to
 * its owner, so the only available view was raw `layout_json` in a table editor.
 * The RM5,000 handoff ran on the founder reading JSON.
 *
 * WHY THE SPECIFICATION IS BUILT HERE RATHER THAN LINKED. `/portal/spec` runs an
 * LLM call to write prose around the structure. The structure itself
 * (`buildSystemSpec`) is extracted deterministically from the layouts and is the
 * part a developer builds from — so the console renders that directly. No token
 * spend to look at a customer, and nothing on this screen can be hallucinated.
 *
 * WHY UNSAVED PAGES ARE STILL SHOWN. A page a customer has never saved has
 * `layout_json = '{}'`, and rendering five empty cards would tell the founder
 * "they designed nothing" when what happened is "they have not saved yet". The
 * generated draft is rebuilt on read here exactly as the customer's own editor
 * does it, and marked as a draft.
 */

const FALLBACK_LABELS = { customer: "客户", order: "订单", staff: "员工" };

type PageRow = {
  page_key: string;
  title: string | null;
  sort_order: number | null;
  updated_at: string | null;
  layout_json: Record<string, unknown> | null;
};

export default async function ConsoleCustomerPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: founder } = await supabase.rpc("is_founder");
  if (!founder) notFound();

  const { data, error } = await supabase.rpc("console_project", {
    target_project_id: projectId,
  });
  if (error || !data) notFound();

  const payload = data as {
    project: Record<string, unknown>;
    email: string;
    industry: Record<string, unknown> | null;
    lead: Record<string, unknown> | null;
    analysis: Record<string, unknown> | null;
    pages: PageRow[];
  };

  // Assembled into the same shape the customer's own editor builds from, so a
  // generated draft here is byte-identical to what they see.
  const businessContext: BusinessContext = {
    industry: payload.industry as BusinessContext["industry"],
    analysis: payload.analysis as BusinessContext["analysis"],
    identity: {
      business_name: (payload.project.business_name as string) ?? null,
      owner_name: (payload.project.owner_name as string) ?? null,
    },
  };
  const labels = businessContext.industry?.labels ?? FALLBACK_LABELS;
  const ownerName = displayOwnerName(businessContext, payload.email.split("@")[0]);

  const pageRefs = sortPages(
    (payload.pages ?? []).map((p) => ({ key: p.page_key, title: p.title })),
  );

  const pages = pageRefs.map((ref) => {
    const row = (payload.pages ?? []).find((p) => p.page_key === ref.key);
    const saved = (row?.layout_json as Record<string, unknown>) ?? {};
    const isDraft = isUngeneratedLayout(saved);
    return {
      pageKey: ref.key,
      label: pageLabel(ref, labels),
      isDraft,
      updatedAt: row?.updated_at ?? null,
      layout: (isDraft
        ? buildPageLayout(ref.key, businessContext, ownerName, locale, pageRefs)
        : upgradeLayout(saved)) as unknown as Data,
    };
  });

  const spec = buildSystemSpec(
    Object.fromEntries(pages.map((p) => [p.pageKey, p.layout as unknown as PuckLayout])),
    pageRefs,
  );

  return (
    <CustomerDetail
      locale={locale}
      projectId={projectId}
      email={payload.email}
      businessName={(payload.project.business_name as string) ?? null}
      ownerName={(payload.project.owner_name as string) ?? null}
      industryName={(payload.industry?.name_zh as string) ?? null}
      summary={(payload.analysis?.summary as string) ?? null}
      style={((payload.project.style as StyleName) ?? "blueprint") as StyleName}
      palette={(payload.project.palette as string | null) ?? null}
      stage={(payload.project.stage as string) ?? "designing"}
      devFee={Number(payload.project.dev_fee_myr ?? 5000)}
      monthlyFee={Number(payload.project.monthly_fee_myr ?? 150)}
      note={(payload.project.founder_note as string) ?? null}
      pages={pages}
      specText={specToText(spec)}
    />
  );
}
