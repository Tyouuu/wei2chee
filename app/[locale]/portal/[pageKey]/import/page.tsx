import { StyleScope } from "@/design-system/editor/style-scope";
/* 这三页只有工作台会开 —— 加一单 · 改这一单 · 搬旧资料。
   客户挑的那一套（`ctx.style`）从 2026-09-04 起只管官网。 */
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { loadRecordPage } from "../record-context";
import { RECORD_COPY } from "../record-copy";
import { ImportForm } from "./import-form";
import type { SheetColumn } from "@/lib/portal/import-sheet";

/**
 * 把旧的资料搬进来。
 *
 * ── 为什么它是刚需，不是方便 ─────────────────────────────────────────────
 *
 * [任务 113] 量到：**73% 的中小企业还在用试算表**，而那才是真正的对手。
 * 我们给他的第一个画面是**零行**，然后请他一行一行打进去六年的客户名单。
 * 那不是一个门槛，那是一个不用的理由。
 *
 * ── 栏位是这一页自己的 ────────────────────────────────────────────────────
 *
 * 跟「加一单」同一个来源（`loadRecordPage`）：一个车厂加了「车牌号」，
 * 汇入那一页的表头就认得「车牌号」，而且它会进 `extra`。
 * 没有人为每一行生意写一份汇入范本。
 */

/** 内建那几栏在表格上的键，跟送进资料库的键对起来。 */
const BUILT_IN: Record<string, Record<string, string>> = {
  pipeline: { primary: "title", secondary: "party", amount: "amount_cents", status: "stage" },
  directory: { primary: "name", secondary: "phone", status: "status" },
  ledger: { primary: "note", secondary: "party", amount: "amount_cents", status: "" },
};

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string; pageKey: string }>;
}) {
  const { locale, pageKey } = await params;
  const ctx = await loadRecordPage(locale, pageKey);
  const copy = RECORD_COPY[ctx.lang];

  const map = BUILT_IN[ctx.shape] ?? {};
  const ownKeys: string[] = [];
  const columns: SheetColumn[] = [];
  for (const c of ctx.columns) {
    const mapped = map[c.key];
    /* 「」代表那一栏在这个形状上不是他填的（收款的状态是从钱算出来的），
       所以汇入也不该收它 —— 收一个会被系统盖掉的值，是骗他打字。 */
    if (mapped === "") continue;
    const key = mapped ?? c.key;
    if (!mapped) ownKeys.push(key);
    columns.push({ key, label: c.label });
  }
  /* 名册那一边最要紧的两栏不在表格上（表格第二栏是拼出来的联络字串），
     而 WhatsApp 号码正是[任务 48](#48) 讲的那一件：它有工作要做。 */
  if (ctx.shape === "directory") {
    columns.push(
      { key: "whatsapp", label: copy.form.whatsapp },
      { key: "email", label: copy.form.email },
      { key: "address", label: copy.form.address },
      { key: "region", label: copy.form.region },
    );
  }

  return (
    <StyleScope register={SYSTEM_REGISTER} palette={ctx.palette} className="min-h-screen">
      <main className="mx-auto w-full max-w-[760px] px-6 py-10">
        <h1 className="ds-display [font-size:var(--text-title)] tracking-[var(--tracking-title)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.form.importHeading} · {ctx.title}
        </h1>
        <p className="mt-1 mb-7 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.form.importLede}
        </p>
        <ImportForm
          projectId={ctx.projectId}
          moduleKey={ctx.pageKey}
          columns={columns}
          ownKeys={ownKeys}
          backHref={ctx.backHref}
          /* 只有字串。函式过不去 —— 见 record-copy.ts 的档头。 */
          copy={copy.form}
        />
      </main>
    </StyleScope>
  );
}
