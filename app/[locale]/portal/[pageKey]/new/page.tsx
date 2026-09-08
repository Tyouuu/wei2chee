import { StyleScope } from "@/design-system/editor/style-scope";
/* 这三页只有工作台会开 —— 加一单 · 改这一单 · 搬旧资料。
   客户挑的那一套（`ctx.style`）从 2026-09-04 起只管官网。 */
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { RecordShell } from "../record-shell";
import { loadRecordPage } from "../record-context";
import { NewRecordForm } from "./new-record-form";
import { RECORD_COPY } from "../record-copy";
import { todayInMalaysia } from "@/lib/portal/live-months";

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
 * 号」 gets a box for it and nobody writes a form per trade. Loaded by
 * loadRecordPage, which 改这一单 shares -- see the note there.
 */

export default async function NewRecordPage({
  params,
}: {
  params: Promise<{ locale: string; pageKey: string }>;
}) {
  const { locale, pageKey } = await params;
  const ctx = await loadRecordPage(locale, pageKey);
  const copy = RECORD_COPY[ctx.lang];

  return (
    /* THE CUSTOMER'S OWN STYLE, NOT OURS.

       The first version wore `chrome` -- Formae's dark shell. On a red-and-
       cream system it read as a different product entirely, which is exactly
       the 四不像 of 任务 20. This form is part of HIS system: the same page he
       just left, one click away, has to look like it.

       Found by looking at the screenshot. Every check passed first. */
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={ctx.palette}
      data-surface="desk"
      className="min-h-screen"
    >
      {/* 🔴 2026-09-04：这一页搬进系统的外壳里。老板：`不要设计看起来是好像
          两个人做得一样 一定要统一设计`。它本来是一张浮在灰底上的表单 ——
          系统每一页都有侧栏跟顶栏，只有它没有，而客户是从系统里点进来的。
          见 record-shell.tsx。 */}
      <RecordShell ctx={ctx}>
        {/* Wider when there is a document beside the form -- 560px cannot
          hold both. Narrow everywhere else: a name list and a shelf make no
          paper, and a wide column of short boxes reads as a form with
          something missing from it.
          ⚠️ 左右的内距交给外壳了（`--pad-card-lg`）—— 两层内距会把这一页
          推得比系统其他每一页都窄。 */}
        <main
          className={`w-full ${
            ctx.shape === "pipeline" ? "max-w-[1080px]" : "max-w-[560px]"
          }`}
        >
          {/* 🔴 标题跟那一句说明交给表单画（2026-09-04）。参考页的主要动作
            在标题右边，而那颗按钮要知道「现在正在存」—— 这一页是伺服器画的，
            读不到那件事。所以标题跟按钮住在一起。 */}
          <NewRecordForm
            heading={copy.heading(ctx.title)}
            lede={copy.lede}
            projectId={ctx.projectId}
            moduleKey={ctx.pageKey}
            /* One value, not a boolean per shape: a page is exactly one of the
             three, and a boolean each is how two of them end up true. */
            shape={
              ctx.shape as
                | "pipeline"
                | "ledger"
                | "directory"
                | "catalog"
                | "reconcile"
                | "calendar"
            }
            parties={ctx.parties}
            columns={ctx.columns}
            title={ctx.title}
            today={todayInMalaysia()}
            stages={ctx.stages}
            trade={ctx.trade}
            openDocuments={ctx.openDocuments}
            partyAddresses={ctx.partyAddresses}
            partyDebts={ctx.partyDebts}
            branches={ctx.branches}
            staff={ctx.staff}
            businessName={ctx.businessName}
            jobs={ctx.jobsForCost}
            categories={ctx.categories}
            backHref={ctx.backHref}
            /* Only the strings. `heading` is a function, and a function cannot
             cross from a server component to a client one -- it renders as a
             500 the first time the page is opened, which is exactly how this
             was found: by opening it. Passing the whole object type-checked
             fine, because an excess property on a variable is not an excess
             property. */
            copy={copy.form}
          />

          {/* 🔴 把旧的一次搬进来。
            画在这里，不是画成表头上第二颗按钮，有两个理由：
            ① 表头那颗（`actionHref`）住在 `industry-template` 跟
               `PageHeader` 里，而那两个是另一个 session 的地盘（重点 20）
            ② **这里才是他想到那件事的时刻** —— 一个打开「加一单」、
               然后意识到自己有两百笔要打的人，正好在看这一页。 */}
          {/* 一条小小的架子：搬旧资料 · 分店。
            ⚠️ 分店那一条**在这里**，因为侧栏是 portal 的壳，而那是另一个
            session 的地盘（重点 20）—— 而一个开得了店、却没有任何地方
            点得进去的页面，就是这个仓库最常犯的那个错。 */}
          <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            <a
              href={`/${locale}/portal/${pageKey}/import`}
              className="underline"
            >
              {copy.form.importHeading}
            </a>
            {ctx.shape === "pipeline" || ctx.shape === "ledger" ? (
              <a href={`/${locale}/portal/branches`} className="underline">
                {copy.form.branch}
              </a>
            ) : null}
            {/* 要跟的事。⚠️ **不挡师傅** —— 「明天去工地量尺寸」是他一天的
              工作，而 `follow_ups_due` 是 works_here。跟谁欠我钱正好相反。 */}
            <a href={`/${locale}/portal/today`} className="underline">
              {copy.form.todayLink}
            </a>
            {/* 谁欠我钱。⚠️ **只有老板** —— 那一页对师傅是 404，
              而一条通往 404 的连结比没有连结糟。
              `party_aging` 自己也是 sees_money。 */}
            {ctx.role === "owner" ? (
              <a href={`/${locale}/portal/owing`} className="underline">
                {copy.form.owingLink}
              </a>
            ) : null}
            {/* 🔴 车牌跟保养合约**在侧栏上是按有没有资料画的**（见 portal-shell），
              所以一间还没登记过任何一台车的车厂，在侧栏上看不到它们 ——
              而那正是他最需要第一个入口的那一刻。这一条就是那个入口。

              放在这里跟搬旧资料 · 分店同一个理由：**这里是他想到那件事的时刻**
              —— 一个打开「加一单」、发现自己要记的其实是一台车或者一份合约的人，
              正好在看这一页。 */}
            <a href={`/${locale}/portal/vehicles`} className="underline">
              {copy.form.vehiclesLink}
            </a>
            <a href={`/${locale}/portal/contracts`} className="underline">
              {copy.form.contractsLink}
            </a>
            {/* ⚠️ 序号那一页同一条：侧栏上按**有没有一件货开了序号**画，
              而一间车行第一次要开的那一件，正好是在这一页想到的。 */}
            <a href={`/${locale}/portal/serials`} className="underline">
              {copy.form.serialsLink}
            </a>
            {/* 🔴 餐台同一条：侧栏上按**有没有开过桌**画，而第一张桌
              没有任何地方开得出来。

              ⚠️ 而这一条**只画给餐饮**，不像上面那三条无条件画 ——
              [任务 253] 已经登记过那条架子太宽（一间装修公司不需要看到
              「查一个车牌」），而餐台是那一条最明显的一个：
              八个行业里只有一个有桌。 */}
            {ctx.trade === "fnb" ? (
              <a href={`/${locale}/portal/tables`} className="underline">
                {copy.form.tablesLink}
              </a>
            ) : null}
          </p>
        </main>
      </RecordShell>
    </StyleScope>
  );
}
