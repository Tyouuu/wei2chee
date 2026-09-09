import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { TreatmentDesk, type Guest } from "./treatment-desk";

/**
 * 上一次帮她做了什么 —— 而她签了没有。
 *
 * ── 为什么这一页要存在（2026-09-09）─────────────────────────────────────
 *
 * 老板看着另一个 session 的报告：**`你还有功能还没接到画面`**。
 * 那份报告自己写着「不是我这一边」，而那三格里最大的一格就是这一页：
 * `add_treatment_note` · `treatment_notes_of` · `add_treatment_product` ·
 * `treatment_photos_of` —— [任务 326](../../../../../docs/founder-tasks.md#326)
 * 走完十一节全绿，**而她今天在系统里看不到任何一笔**。
 * 建好了没有人到得了的东西，跟不存在的东西，在报告里长得一模一样。
 *
 * ── 🔴 这一页的骨架是抄来的，不是我想的 ────────────────────────────────
 *
 * 老板 2026-09-09（一晚讲了四次）：
 * `你一定要记得什么去接画面 都是去外网去做深度研究 我们借鉴别人的做法`
 * （[重点 7n](../../../../../docs/founder-points.md)）。
 *
 * 所以先拍：`shoot:tradepages` 21 家 ＋ `shoot:featurepage` 18 家，
 * 拼图在 `.screenshots/featurepages/sheet-②.jpg`。**四家的做法是同一个**：
 *
 *   Boulevard「Make the most of every visit」  左边客人清单，右边那个人的几段
 *   Timely「Client management」                 一模一样
 *   Mangomint「Create SOAP notes」              表单在左，**前后照片在右边一栏**
 *   Aesthetic Record「What is Charted is What is Charged」  记了什么就算什么钱
 *
 * 所以这一页是：**左边一条客人清单，右边那个客人的两段** ——
 * 她签了没有（同意书）· 上一次做了什么（疗程）。
 * 而那正是[任务 247](../../../../../docs/founder-tasks.md) 那条规矩：
 * **一份同意书属於一个人，而她想到那件事的时候，正在看那个人。**
 *
 * ── ⚠️ 它还不是什么 ─────────────────────────────────────────────────────
 *
 * · **不是客户详情页**（[任务 81](../../../../../docs/founder-tasks.md#81) 那一页还是不存在）——
 *   这里只答「做过什么 · 签了没有」，地址跟税号不在这里
 * · **照片只数不画**：`treatment_photos_of` 在，而前后照片那一栏要一个
 *   上传的入口跟一个私人的桶，那是另一件事
 * · **不接帐**：Aesthetic Record 那一句「记了什么就算什么钱」我们做不到 ——
 *   `add_treatment_product` 今天扣的是**架上的货**，不是单上的钱
 *
 * ── 谁打得开 ────────────────────────────────────────────────────────────
 *
 * 底下那几支都是 `works_here`：**写这一笔的常常就是美疗师自己**，
 * 而这一页上一个金额都没有 —— 跟同意书那一页同一条判断。
 */

export default async function TreatmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const [{ data: paletteRow }, guestRes, staffRes] = await Promise.all([
    supabase
      .from("projects")
      .select("palette")
      .eq("id", workspace.projectId)
      .maybeSingle(),
    /* 客人 —— **按名字排**，因为这一份是**读下去找人**的清单，
       不是「刚刚加的那一个」。跟名册那一页同一条（`live-rows` 的注解）。 */
    supabase
      .from("directory_entries")
      .select("id, name, phone, whatsapp")
      .eq("project_id", workspace.projectId)
      .eq("module_key", "customers")
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(400),
    supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", workspace.projectId)
      .eq("module_key", "staff")
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(100),
  ]);

  const palette = (paletteRow?.palette as string | null) ?? null;
  const guests = (guestRes?.data ?? []) as Guest[];
  const staff = (staffRes?.data ?? []) as { id: string; name: string }[];

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("treatments.title")} subtitle={t("treatments.lede")} />
      <PageBody>
        <TreatmentDesk
          guests={guests}
          staff={staff}
          words={{
            who: t("treatments.who"),
            find: t("treatments.find"),
            noGuests: t("treatments.noGuests"),
            pick: t("treatments.pick"),
            consentTitle: t("treatments.consentTitle"),
            consentNone: t("treatments.consentNone"),
            signed: t("treatments.signed"),
            waiting: t("treatments.waiting"),
            notesTitle: t("treatments.notesTitle"),
            noNotes: t("treatments.noNotes"),
            add: t("treatments.add"),
            what: t("treatments.what"),
            area: t("treatments.area"),
            note: t("treatments.note"),
            byWho: t("treatments.byWho"),
            nobody: t("treatments.nobody"),
            save: t("treatments.save"),
            saving: t("treatments.saving"),
            cancel: t("treatments.cancel"),
            needWhat: t("treatments.needWhat"),
            failed: t("treatments.failed"),
            used: t("treatments.used"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
