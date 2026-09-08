"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 一张桌一张卡：空的，或者坐着人。
 *
 * ── 🔴 为什么加一碟在这一页上，不在那张单的记录页上 ────────────────────
 *
 * 客人点菜是在**桌边**发生的。而更硬的一个理由是资料库那边定的：
 * 加菜不可以走 `set_record_lines`（那是整批换，会把已经出的菜归零 ——
 * 20260908050000 那条收紧就是在挡它），要走 `append_record_line`。
 * 记录页上那个逐项编辑器走的是前者，所以**加一碟只有这里有**。
 *
 * ── 🔴 结帐一按做两件 ───────────────────────────────────────────────────
 *
 * 收钱 ＋ 清桌是同一按（`close_table`）—— 开台 1 · 加菜 n · 收钱 1 · 清桌 1，
 * 一天一百桌，那多出来的一按就是一百按
 * （[重点 29](../../../../../docs/founder-points.md)）。
 * 收多少留空 = 赊数：桌子照样放开，而那一张单自己留在「谁欠我钱」上。
 *
 * ── 伙计跟老板 ──────────────────────────────────────────────────────────
 *
 * 带位 · 点菜 · 清桌都是伙计的工作。只有两样是老板的：
 * **开／关一张桌**（店的设定）跟**收钱**。而收钱那一颗**不藏起来** ——
 * 资料库那一支自己会先讲一句人话再挡，而藏起来他会以为系统坏了。
 */

export type TableRow = {
  table_id: string;
  name: string;
  seats: number | null;
  sort_order: number;
  record_id: string | null;
  doc_no: string | null;
  title: string | null;
  party: string | null;
  seated_at: string | null;
  seated_minutes: number | null;
  lines: number | null;
  total_cents: number | null;
};

const money = (cents: number) =>
  "RM " + (cents / 100).toLocaleString("en-MY", { minimumFractionDigits: 2 });

export function TablesDesk({
  projectId,
  locale,
  isOwner,
  pipelineKey,
  rows,
  tables,
}: {
  projectId: string;
  locale: string;
  isOwner: boolean;
  pipelineKey: string | null;
  rows: readonly TableRow[];
  /** 开着的跟关掉的都要 —— 关掉的那几张只有这一段看得到。 */
  tables: readonly {
    id: string;
    name: string;
    seats: number | null;
    active: boolean;
  }[];
}) {
  /* 🔴 这一层自己拿字典，不吃上一层传下来的字串。
     理由是量出来的：一句带 {n} 的话，在服务端 t(key) 拿不到值就整个解析不出来，
     而画面上印的是**键名**（第一次跑那一屏上写着 portal.kitchen.stillDue）——
     一个只在有数字的时候才坏掉的翻译，静静地就上线了。 */
  const t = useTranslations("portal.tables");
  /* 现在坐着人的那几张 —— 那几张关不掉。 */
  const seatedIds = new Set(
    rows.filter((r) => r.record_id).map((r) => r.table_id),
  );
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  /* 哪一张桌摊开着一格「加一碟」或者「结帐」。一次只摊一格。 */
  const [openOn, setOpenOn] = useState<{
    id: string;
    what: "dish" | "pay";
  } | null>(null);
  const [dish, setDish] = useState("");
  const [dishQty, setDishQty] = useState("1");
  const [dishPrice, setDishPrice] = useState("");
  const [took, setTook] = useState("");
  const [newName, setNewName] = useState("");
  const [newSeats, setNewSeats] = useState("");

  const db = () => createBrowserSupabaseClient();
  const done = () => {
    setOpenOn(null);
    setDish("");
    setDishQty("1");
    setDishPrice("");
    setTook("");
    router.refresh();
  };

  /* ⚠️ `PromiseLike`，不是 `Promise` —— supabase 那个 builder **是个 thenable，
     不是完整的 Promise**（没有 `.catch` / `.finally`）。这个仓库栽过一次：
     [任务 213] 那一支尺挂了 `.catch(() => {})`，整支当场炸掉而它照样印「全部过」。
     `await` 吃得下 thenable，所以这里要的就是 `PromiseLike`。 */
  async function run<T>(
    fn: () => PromiseLike<{ data: T; error: { message: string } | null }>,
    after?: (data: T) => void,
  ) {
    setError(null);
    setSaid(null);
    setBusy(true);
    try {
      const { data, error: err } = await fn();
      if (err) {
        setError(err.message);
        return;
      }
      after?.(data);
      done();
    } finally {
      setBusy(false);
    }
  }

  const seat = (row: TableRow) =>
    run(() =>
      db().rpc("seat_table", {
        in_project_id: projectId,
        in_table_id: row.table_id,
        in_module_key: pipelineKey,
        in_title: row.name,
      }),
    );

  const addDish = (row: TableRow) => {
    if (!row.record_id || !dish.trim()) return;
    const qty = Number(dishQty);
    const price =
      dishPrice.trim() === "" ? null : Math.round(Number(dishPrice) * 100);
    return run(() =>
      db().rpc("append_record_line", {
        in_record_id: row.record_id,
        in_description: dish.trim(),
        in_qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        in_unit_price_cents: price,
      }),
    );
  };

  const settle = (row: TableRow) => {
    const paid = took.trim() === "" ? 0 : Math.round(Number(took) * 100);
    return run<
      { change_cents: number; owed_cents: number; freed: boolean }[] | null
    >(
      () =>
        db().rpc("close_table", {
          in_project_id: projectId,
          in_table_id: row.table_id,
          in_paid_cents: Number.isFinite(paid) && paid > 0 ? paid : 0,
        }),
      (data) => {
        const r = Array.isArray(data) ? data[0] : data;
        if (!r?.freed) return;
        /* 🔴 找他多少 · 还欠多少 —— 讲出来，不然他要自己在心里算。
           那两个数字是资料库算的，这里一个都不重算。 */
        const bits: string[] = [];
        if (Number(r.change_cents) > 0)
          bits.push(t("change", { n: money(Number(r.change_cents)) }));
        if (Number(r.owed_cents) > 0)
          bits.push(t("owed", { n: money(Number(r.owed_cents)) }));
        setSaid([t("freed", { t: row.name }), ...bits].join(" · "));
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <DeskCard title={t("mapTitle")}>
        {rows.length === 0 ? (
          <p className={deskDim}>{t("none")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const busyHere = openOn?.id === row.table_id;
              return (
                <div
                  key={row.table_id}
                  data-table={row.name}
                  className="flex flex-col gap-2 [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] p-3"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] text-[color:var(--color-paper)]">
                      {row.name}
                    </span>
                    {row.seats ? (
                      <span className={deskDim}>
                        {t("seats", { n: row.seats })}
                      </span>
                    ) : null}
                  </div>

                  {row.record_id ? (
                    <>
                      {/* 🔴 一桌一眼要看的三样：多少钱 · 几行 · 坐多久。
                        金额最大 —— 那是他念给客人听的那一个。 */}
                      <span className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-paper)]">
                        {money(Number(row.total_cents ?? 0))}
                      </span>
                      <span className={deskDim}>
                        {[
                          row.party,
                          t("lines", { n: row.lines ?? 0 }),
                          row.seated_minutes === null
                            ? null
                            : t("minutes", { n: row.seated_minutes }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setOpenOn(
                              busyHere && openOn?.what === "dish"
                                ? null
                                : { id: row.table_id, what: "dish" },
                            )
                          }
                          className={deskBtn("quiet")}
                        >
                          {t("addDish")}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setOpenOn(
                              busyHere && openOn?.what === "pay"
                                ? null
                                : { id: row.table_id, what: "pay" },
                            )
                          }
                          className={deskBtn("primary")}
                        >
                          {t("settle")}
                        </button>
                        <a
                          href={`/${locale}/portal/${pipelineKey}/${row.record_id}`}
                          className="inline-flex min-h-11 items-center [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline"
                        >
                          {row.doc_no ?? t("open")}
                        </a>
                      </div>

                      {busyHere && openOn?.what === "dish" ? (
                        <div className="flex flex-col gap-2 pt-1">
                          <input
                            aria-label={t("dish")}
                            placeholder={t("dish")}
                            value={dish}
                            onChange={(e) => setDish(e.target.value)}
                            className={deskField}
                          />
                          <div className="flex gap-2">
                            <input
                              aria-label={t("howMany")}
                              placeholder={t("howMany")}
                              inputMode="decimal"
                              value={dishQty}
                              onChange={(e) => setDishQty(e.target.value)}
                              className={`${deskField} min-w-0 flex-1`}
                            />
                            <input
                              aria-label={t("each")}
                              placeholder={t("each")}
                              inputMode="decimal"
                              value={dishPrice}
                              onChange={(e) => setDishPrice(e.target.value)}
                              className={`${deskField} min-w-0 flex-1`}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={busy || !dish.trim()}
                            onClick={() => void addDish(row)}
                            className={deskBtn("primary")}
                          >
                            {t("add")}
                          </button>
                        </div>
                      ) : null}

                      {busyHere && openOn?.what === "pay" ? (
                        <div className="flex flex-col gap-2 pt-1">
                          <input
                            aria-label={t("took")}
                            placeholder={t("took")}
                            inputMode="decimal"
                            value={took}
                            onChange={(e) => setTook(e.target.value)}
                            className={deskField}
                          />
                          {/* 🔴 收多少留空 = 赊数，讲出来。 */}
                          <p className={deskDim}>{t("onTab")}</p>
                          {/* 🔴 这一颗**不可以**再叫 Settle。
                            摊开之后同一张桌上会有两颗一模一样的按钮，
                            而他不知道哪一颗做什么 —— 那是真的开浏览器
                            按一次才看到的（Playwright 直接拒绝跑）。
                            上面那一颗是「打开」，这一颗是「收下」。 */}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void settle(row)}
                            className={deskBtn("primary")}
                          >
                            {busy ? t("settling") : t("settleNow")}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className={deskDim}>{t("empty")}</span>
                      <button
                        type="button"
                        disabled={busy || !pipelineKey}
                        onClick={() => void seat(row)}
                        className={deskBtn("primary")}
                      >
                        {busy ? t("seating") : t("seat")}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DeskCard>

      {said ? (
        <p
          role="status"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]"
        >
          {said}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {error}
        </p>
      ) : null}

      {/* 🔴 开一张桌是店的设定，只有老板 —— 资料库那边也是 sees_money。
        伙计打开这一页看得到桌台图，看不到这一段。 */}
      {isOwner ? (
        <DeskCard title={t("setupTitle")}>
          <div className="flex flex-col gap-4">
            {/* 🔴 一串桌，开着的在上、关掉的在下，每一行右边一颗开关 ——
              跟分店那一页同一个形状。

              第一版把「关掉某一张」做成底下一排孤零零的连结，而且就压在
              「没有关掉的桌」那一句下面 —— 一句说没有，紧接着两颗写着
              「关掉 5」「关掉 6」。**那是用眼睛看图才看到的**，读数当时全绿。 */}
            <div className="flex flex-col gap-4">
              {([true, false] as const).map((active) => {
                const some = tables.filter((r) => r.active === active);
                if (some.length === 0) return null;
                return (
                  <div key={String(active)} className="flex flex-col gap-1.5">
                    {!active ? (
                      <p className={deskDim}>{t("closedLabel")}</p>
                    ) : null}
                    <div className="flex flex-col [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]">
                      {some.map((r, i) => {
                        const busyTable = seatedIds.has(r.id);
                        return (
                          <div
                            key={r.id}
                            className={`flex min-h-12 items-center gap-3 px-3 py-2 [font-size:var(--text-sm)] ${
                              i
                                ? "border-t [border-color:var(--color-ink-800)]"
                                : ""
                            }`}
                          >
                            <span
                              className={
                                active
                                  ? "flex-1 [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]"
                                  : `flex-1 ${deskDim}`
                              }
                            >
                              {r.name}
                              {r.seats ? (
                                <span className={` ${deskDim}`}>
                                  {" · "}
                                  {t("seats", { n: r.seats })}
                                </span>
                              ) : null}
                            </span>
                            {/* 🔴 坐着人的关不掉，而且讲得出为什么 ——
                              一张坐着人的桌从图上消失，那一桌的帐就没有人看得到了。 */}
                            {busyTable ? (
                              <span className={deskDim}>
                                {t("cannotClose")}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(() =>
                                    db().rpc("update_dining_table", {
                                      in_table_id: r.id,
                                      in_active: !r.active,
                                    }),
                                  )
                                }
                                className="min-h-11 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline disabled:opacity-60"
                              >
                                {r.active ? t("closeIt") : t("reopen")}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🔴 窄屏堆起来，不是挤在一行。
              第一版三样挤一行，而位子那一格跟按钮都是 shrink-0 ——
              390 上「他自己的叫法」被压成 40px，画面上只看得到两个字母。
              那是用眼睛看那张手机图才看到的（重点 24：判这一页的是那个
              在手机上的人）。 */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                aria-label={t("newName")}
                placeholder={t("newName")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={`${deskField} min-w-0 sm:flex-1`}
              />
              <div className="flex items-center gap-2">
                {/* ⚠️ 宽度加在**外面那个框**上 —— deskField 自己带着 w-full，
                而两个宽度谁赢是**样式表里谁在后面**决定的，不是字串里谁在后面。
                这个仓库栽在同一件事上两次了（任务 203 · 217）。 */}
                <div className="w-28 shrink-0">
                  <input
                    aria-label={t("newSeats")}
                    placeholder={t("newSeats")}
                    inputMode="numeric"
                    value={newSeats}
                    onChange={(e) => setNewSeats(e.target.value)}
                    className={deskField}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || !newName.trim()}
                  onClick={() =>
                    void run(
                      () =>
                        db().rpc("add_dining_table", {
                          in_project_id: projectId,
                          in_name: newName.trim(),
                          in_seats:
                            newSeats.trim() === "" ? null : Number(newSeats),
                        }),
                      () => {
                        setNewName("");
                        /* 🔴 位子那一格也要清掉 —— 留着，下一张桌会静静地
                        继承上一张的位子数，而他不会发现。 */
                        setNewSeats("");
                      },
                    )
                  }
                  className={`${deskBtn("primary")} shrink-0`}
                >
                  {t("openTable")}
                </button>
              </div>
            </div>
          </div>
        </DeskCard>
      ) : null}
    </div>
  );
}
