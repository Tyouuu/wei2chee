import { StyleScope } from "@/design-system/editor/style-scope";
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
    <StyleScope register={ctx.style} palette={ctx.palette} className="min-h-screen">
      {/* Wider when there is a document beside the form -- 560px cannot
          hold both. Narrow everywhere else: a name list and a shelf make no
          paper, and a wide column of short boxes reads as a form with
          something missing from it. */}
      <main
        className={`mx-auto w-full px-6 py-10 ${
          ctx.shape === "pipeline" ? "max-w-[1080px]" : "max-w-[560px]"
        }`}
      >
        <h1 className="ds-display [font-size:var(--text-title)] tracking-[var(--tracking-title)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.heading(ctx.title)}
        </h1>
        <p className="mt-1 mb-7 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.lede}
        </p>
        <NewRecordForm
          projectId={ctx.projectId}
          moduleKey={ctx.pageKey}
          /* One value, not a boolean per shape: a page is exactly one of the
             three, and a boolean each is how two of them end up true. */
          shape={ctx.shape as "pipeline" | "ledger" | "directory" | "catalog" | "reconcile" | "calendar"}
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
          <a href={`/${locale}/portal/${pageKey}/import`} className="underline">
            {copy.form.importHeading}
          </a>
          {ctx.shape === "pipeline" || ctx.shape === "ledger" ? (
            <a href={`/${locale}/portal/branches`} className="underline">
              {copy.form.branch}
            </a>
          ) : null}
        </p>
      </main>
    </StyleScope>
  );
}
