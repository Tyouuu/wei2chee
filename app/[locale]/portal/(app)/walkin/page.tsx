import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { WalkinDesk, type StaffRow } from "./walkin-desk";

/**
 * 走单客人轮到谁 —— 柜台的那面白板，算出来的。
 *
 * ── 为什么这一页要存在（2026-09-10）─────────────────────────────────────
 *
 * `walkin_queue_of` · `next_for_walkin` · `take_walkin_turn` ·
 * `set_walkin_available`（20260910360000）四支全部用真的登入身分验过
 * （`check:walkin` 全绿），而[任务 354](../../../../../docs/founder-tasks.md#354)
 * 自己写着：「走单轮位画面 —— 规格写好了，画面还没有。」
 * 建好了没有人到得了的东西，跟不存在的东西，在报告里长得一模一样。
 *
 * ── 🔴 这一页的骨架是抄来的（`shoot:featurepage` 第六组）───────────────
 *
 * 老板 2026-09-09（一晚讲了四次）：`你一定要记得什么去接画面 都是去外网
 * 去做深度研究`（[重点 7n](../../../../../docs/founder-points.md)）。
 * 拍了 Fresha · Vagaro · Booksy · Square Appointments · Mangomint 五家的
 * 排班／团队页（`.screenshots/featurepages/sheet-⑥.jpg`，WebSearch 那一刻
 * 不通，照旧不猜网址）—— **没有一家把「走单排队」单独当一屏卖**，
 * 它们卖的都是「整个日历」。这不是没找到，是这个仓库自己已经量过的一条
 * 市场分界线（[重点 34]，migration 档头写着：Vagaro 没有这一件，
 * 这是真的分界线，不是人人都有）。
 *
 * 所以骨架照本站自己已经在跑、而且刚刚才通过眼睛验收的那一份抄
 * （[任务 342] 名册行 · [任务 322] 同意书页）：**一张卡，一条清单，
 * 每一行头像 + 名字 + 一句状态字**，跟同意书 · 疗程记录同一层壳
 * （`page-bar.tsx` + `desk-kit.tsx`）。这是产品自己的语言，不是发明一个新的。
 *
 * ── 🔴 排好的顺序，是算出来的，不是存起来的 ────────────────────────────
 *
 * `walkin_queue_of` 只回「在轮子里」的那几个人。而柜台要把步出轮子的那位
 * 叫回来，也要在这一页上看得到她 —— 所以这里直接读整份师傅名单
 * （`directory_entries`，跟疗程记录那一页读法一样），排序交给这个档案自己
 * 的 JS（`nulls first, name`，跟资料库那支同一条规则，理由见
 * `walkin-desk.tsx` 档头），而不是另外再叫一次 RPC 去核对同一个答案。
 *
 * ── 谁打得开 ────────────────────────────────────────────────────────────
 *
 * 四支全部是 `works_here`：站在柜台叫下一位的常常就是美发师自己，
 * 这一页上也一个金额都没有 —— 跟同意书 · 疗程记录同一条判断。
 */

export default async function WalkinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const [{ data: paletteRow }, staffRes] = await Promise.all([
    supabase
      .from("projects")
      .select("palette")
      .eq("id", workspace.projectId)
      .maybeSingle(),
    supabase
      .from("directory_entries")
      .select("id, name, last_walkin_at, walkin_available")
      .eq("project_id", workspace.projectId)
      .eq("module_key", "staff")
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(200),
  ]);

  const palette = (paletteRow?.palette as string | null) ?? null;
  const staff = (staffRes?.data ?? []) as StaffRow[];

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("walkin.title")} subtitle={t("walkin.lede")} />
      <PageBody>
        <WalkinDesk
          staff={staff}
          words={{
            queueLabel: t("walkin.queueLabel"),
            outLabel: t("walkin.outLabel"),
            upNext: t("walkin.upNext"),
            never: t("walkin.never"),
            lastTurn: t("walkin.lastTurn"),
            take: t("walkin.take"),
            taking: t("walkin.taking"),
            stepOut: t("walkin.stepOut"),
            backIn: t("walkin.backIn"),
            empty: t("walkin.empty"),
            noStaff: t("walkin.noStaff"),
            failed: t("walkin.failed"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
