import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import {
  displayBusinessName,
  type BusinessContext,
} from "@/lib/templates/industry-template";
import { showChanges, type ChangeRow } from "@/lib/portal/change-log";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";
import { AuditLogClient, type ActivityRow } from "./audit-log-client";

/**
 * Founder's own Stitch source for "Audit Trail & Activity Log" (Task 405),
 * now reading real record_changes instead of 6 hand-written sample rows --
 * fourth page converted in today's cutover.
 *
 * ── Why one row template, not six categories ────────────────────────────
 *
 * The original had six DIFFERENT shapes of sample row ("Applied 10%
 * Courtesy Loyalty Discount...", "AI Auto-Reconciled WhatsApp Deposit...")
 * -- each a bespoke business narrative with no real audit trail behind it.
 * record_changes logs one row per field a person or the AI assistant
 * actually changed (project_id, entity, entity_id, label, field, was,
 * now_is, changed_by, via_ai, created_at) -- see
 * supabase/migrations/20260904020000 and 20260911300000. That's real and
 * genuinely useful (it distinguishes a human click from the AI assistant
 * acting on the same account -- most competitors' audit logs don't), but
 * it doesn't narrate itself into six fictional stories. Forcing real
 * field-level changes into invented categories would mean guessing which
 * story a change belongs to -- the kind of invention this whole cutover
 * has been refusing to do on every other page.
 *
 * Dropped, not faked: the four METRICS cards (Total Events Today: 142,
 * Staff Manual Edits: 84, AI Auto-Reconciliation: 58, Special Approvals:
 * 5) had no real backing. Real equivalents are computed below instead:
 * total changes, human vs. AI split (via_ai), and entity-type breakdown --
 * "Special Approvals" is dropped outright since nothing in this product
 * models an approval workflow.
 *
 * Owner-only, like every other real reader of this table: record_changes'
 * RLS policy is sees_money(project_id) (see the migration's own header --
 * "this ledger exists so the owner can see what staff did; giving staff
 * read access is neither useful nor right"). A staff login gets an honest
 * "not for your role" message instead of a silently-empty audit log --
 * empty would read as "nothing has ever changed here," which is false.
 */
export default async function SalonAuditLogPreview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);

  const workspace = await loadWorkspace();
  if (!workspace) redirect(`/${locale}/login`);
  const projectId = workspace.projectId;

  const supabase = await createSessionSupabaseClient();

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessName = displayBusinessName(
    (context as BusinessContext | null) ?? {},
  );

  if (!workspace.isOwner) {
    return (
      <>
        <MaterialSymbolsLink />
        <div
          className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
          style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
        >
          <SalonSidebar active="tenant-settings" businessName={businessName} subtitle="Operations" />
          <div className="pl-64 min-h-screen flex flex-col bg-[#f9f9fd]">
            <main className="flex-1 w-full p-8">
              <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-10 text-center text-[13.5px] text-[#77767b]">
                The activity log is only visible to the business owner.
              </div>
            </main>
          </div>
        </div>
      </>
    );
  }

  const { data: changeRows } = await supabase
    .from("record_changes")
    .select("id, entity, entity_id, label, field, was, now_is, changed_by, via_ai, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);

  type RawChange = {
    id: string;
    entity: string;
    entity_id: string;
    label: string | null;
    field: string;
    was: string | null;
    now_is: string | null;
    changed_by: string | null;
    via_ai: boolean | null;
    created_at: string;
  };
  const raw = (changeRows ?? []) as RawChange[];

  // 谁改的——查得到名字才印,一串 uuid 对他没有意义(跟单据详情页同一条规矩)。
  // ⚠️ list_project_members() 只查 project_members 那张表,而老板自己
  // 从来不是那张表里的一行(他是靠 projects.account_id 认出来的)——所以
  // 他自己的改动一直会印成空白。这两类人(老板 + 受邀的员工)刚好是这个
  // 产品里唯一两种真人身分,所以在这里把老板自己的名字补进同一份地图就
  // 补齐了,不用去改共用的 RPC。
  const { data: members } = await supabase.rpc("list_project_members");
  const names: Record<string, string> = Object.fromEntries(
    ((members ?? []) as { user_id: string; email: string | null }[])
      .filter((m) => (m.email ?? "").includes("@"))
      .map((m) => [m.user_id, (m.email ?? "").split("@")[0]]),
  );
  if (user.email?.includes("@")) {
    names[user.id] = user.email.split("@")[0];
  }

  const shown = showChanges(
    raw.map((r) => ({
      id: r.id,
      entity: r.entity as ChangeRow["entity"],
      entityId: r.entity_id,
      label: r.label ?? "",
      field: r.field,
      was: r.was,
      nowIs: r.now_is,
      changedBy: r.changed_by,
      createdAt: r.created_at,
    })),
    { lang: "en", blank: "(empty)", names },
  );

  const rows: ActivityRow[] = raw.map((r, i) => ({
    id: r.id,
    when: shown[i].when,
    entity: r.entity as ActivityRow["entity"],
    label: r.label ?? "",
    field: shown[i].what,
    was: shown[i].was,
    nowIs: shown[i].nowIs,
    isDelete: shown[i].isDelete,
    who: shown[i].who,
    viaAi: r.via_ai === true,
  }));

  const todayStrMY = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  const todayCount = raw.filter((r) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(
      new Date(r.created_at),
    ) === todayStrMY,
  ).length;
  const aiCount = raw.filter((r) => r.via_ai === true).length;
  const humanCount = raw.length - aiCount;

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="tenant-settings" businessName={businessName} subtitle="Operations" />
        <div className="pl-64 min-h-screen flex flex-col bg-[#f9f9fd]">
          <main className="flex-1 w-full p-8">
            <div className="flex flex-col w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] tracking-widest uppercase">
                    <Link href="/en/salon-preview/settings" className="hover:text-[#1a1c1f] transition-colors">SETTINGS</Link>
                    <span className="text-[#c8c5cb]">/</span>
                    <span className="text-[#1a1c1f] font-semibold">AUDIT LOG</span>
                  </div>
                  <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                    Activity &amp; Change History
                  </h1>
                </div>
              </div>

              {/* Real metrics -- replaces the four fabricated METRICS cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-5">
                <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-4 flex flex-col gap-1">
                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                    Changes Today
                  </span>
                  <span className="text-[22px] leading-7 font-bold text-[#000000]">{todayCount}</span>
                </div>
                <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-4 flex flex-col gap-1">
                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                    By Staff
                  </span>
                  <span className="text-[22px] leading-7 font-bold text-[#000000]">{humanCount}</span>
                </div>
                <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-4 flex flex-col gap-1">
                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                    By AI Assistant
                  </span>
                  <span className="text-[22px] leading-7 font-bold text-[#000000]">{aiCount}</span>
                </div>
              </div>

              {rows.length ? (
                <AuditLogClient rows={rows} />
              ) : (
                <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-10 text-center text-[13.5px] text-[#77767b]">
                  No changes have been recorded for this business yet.
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
