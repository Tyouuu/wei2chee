"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Line } from "./line-editor";

/**
 * 不要再让他把同一行字打第二次。
 *
 * ── 为什么这一段存在 ──────────────────────────────────────────────────────
 *
 * 一间五金店的老板，每一张单都要重打一次「水泥 50kg · 包 · 18.50」——
 * 而那三个字**全部就在他自己的货架上**。
 * **那不是一个输入，那是一次抄写。**
 *
 * [任务 150] 20260905 建了三支函式回答这件事，而画面上一个入口都没有 ——
 * 一支没有人呼叫得到的函式，跟一支不存在的函式是同一件事。这一段是那三扇门。
 *
 * ── [重点 29] 四种「不打」，这里做的是第二种 ──────────────────────────────
 *
 *   1. 算出来          数量 × 单价 = 金额（`line-editor` 已经在做）
 *   2. **从他自己以前的东西挑**  ← 这一段
 *   3. 从别的地方搬过来  询价一按变单（[任务 89] 已经在做）
 *   4. 才轮到他打字
 *
 * ── 🔴 只回候选，一个都不自动填 ────────────────────────────────────────────
 *
 * [任务 89] 量过：靠名字自动认人会**把钱记到另一个人头上**，而那是月底
 * 才会发现的那种错。**省他的字，不可以拿「猜」来省。**
 *
 * 所以这里每一样都是他自己按一下才发生的：
 *   · 货架是一份 datalist —— 他打字的时候浏览器自己配，他挑
 *   · 单位同上
 *   · 「照上次那一张」是一颗按钮，不是一个预设值
 *
 * ── 🔴 挑一件货，只填**空的**那几格 ──────────────────────────────────────
 *
 * [任务 144] 立过这一条：**目录上的价是他平常卖的价，这一单谈的价是这一单的。**
 * 一个会盖掉他谈好的价的目录，他第二天就不敢用了。
 * 所以单价跟单位只在那一格是空的时候才填进去。
 *
 * ── 一次抓完，不是每打一个字问一次 ────────────────────────────────────────
 *
 * `suggest_items` 收一个查询字串，而我们传空的把整个货架抓下来，一个专案一次。
 * 理由：一间五个人的店是**几十件货**，不是几万件；而 datalist 的配对是浏览器
 * 自己做的，比每打一个字往返一次快得多，离线也还在。
 * ⚠️ 哪一天有客户的货架大到抓不动，改法是把 `p_q` 接上去，不是改这个形状。
 */

export type ShelfItem = {
  itemId: string;
  name: string;
  unit: string;
  priceCents: number | null;
  onHand: number | null;
};

export type LineSuggestions = {
  /** 他自己的货架。空阵列 = 抓过了没有东西；null = 还没抓完 */
  items: ShelfItem[] | null;
  /** 他自己打过的单位，用得最多的排前面 */
  units: string[];
  /** 上次卖给这个客人的那几行。null = 没有上一张，或者还没问 */
  lastLines: Line[] | null;
  /** 那一张单的单号跟日子 —— 「照上次那一张」要讲得出是哪一张 */
  lastFrom: { docNo: string; on: string } | null;
};

const senOfRow = (v: unknown) => (typeof v === "number" ? v : null);

/** RM 18.50 —— 目录上的价填进那一格的时候写成他会打的样子 */
function priceText(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export function useLineSuggestions({
  projectId,
  partyId,
  moduleKey,
  enabled,
}: {
  projectId: string;
  /** 他挑好的那个客人。null = 还没挑，那就没有「上次」可以问 */
  partyId: string | null;
  moduleKey: string;
  /** 这一页有没有逐项明细。没有就一支都不要打 */
  enabled: boolean;
}): LineSuggestions {
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  const [units, setUnits] = useState<string[]>([]);
  const [lastLines, setLastLines] = useState<Line[] | null>(null);
  const [lastFrom, setLastFrom] = useState<{ docNo: string; on: string } | null>(null);
  /* 🔴 那几行是**哪一个客人**的。
     第一版是在那支 effect 里同步 `setLastLines(null)` 把它洗掉，而 React 19
     的 lint 直接报 error（cascading renders）。改成记住它属於谁，对不上就不给 ——
     **一份算得出来的值，比一份要有人去清掉的状态安全。** */
  const [lastFor, setLastFor] = useState<string | null>(null);

  /* 货架跟单位：一个专案问一次 */
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const supabase = createBrowserSupabaseClient();
    void (async () => {
      const [shelf, usual] = await Promise.all([
        supabase.rpc("suggest_items", { p_project_id: projectId, p_q: "" }),
        supabase.rpc("usual_units", { p_project_id: projectId }),
      ]);
      if (!alive) return;
      /* 🔴 读不到就留 null，不要塞一个空阵列 —— 空阵列的意思是
         「问过了，他货架上没东西」，而那两句在画面上要长得不一样。 */
      if (!shelf.error) {
        setItems(
          (shelf.data ?? []).map((r: Record<string, unknown>) => ({
            itemId: String(r.item_id ?? ""),
            name: String(r.name ?? ""),
            unit: String(r.unit ?? ""),
            priceCents: senOfRow(r.price_cents),
            onHand: senOfRow(r.on_hand),
          })),
        );
      }
      if (!usual.error) {
        setUnits((usual.data ?? []).map((r: Record<string, unknown>) => String(r.unit ?? "")).filter(Boolean));
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId, enabled]);

  /* 上次卖给这个客人什么：他换一个客人就重问 */
  useEffect(() => {
    if (!enabled || !partyId) return;
    let alive = true;
    void (async () => {
      const { data, error } = await createBrowserSupabaseClient().rpc("last_lines_for_party", {
        p_project_id: projectId,
        p_party_id: partyId,
        p_module_key: moduleKey,
      });
      if (!alive) return;
      setLastFor(partyId);
      if (error || !data?.length) {
        setLastLines(null);
        setLastFrom(null);
        return;
      }
      setLastLines(
        (data as Record<string, unknown>[]).map((r) => ({
          description: String(r.description ?? ""),
          qty: r.qty == null ? "" : String(r.qty),
          unit: String(r.unit ?? ""),
          unitPrice: priceText(senOfRow(r.unit_price_cents)),
          amount: priceText(senOfRow(r.amount_cents)),
        })),
      );
      const head = (data as Record<string, unknown>[])[0];
      setLastFrom({
        docNo: String(head.from_doc_no ?? ""),
        on: String(head.from_date ?? ""),
      });
    })();
    return () => {
      alive = false;
    };
  }, [projectId, partyId, moduleKey, enabled]);

  /* 🔴 换了客人，上一个客人那几行**当场不算数** —— 不用等那支查询回来。
     一份还没洗掉的旧清单，按下去会把另一个人的单整批填进这一张。 */
  const mine = enabled && !!partyId && lastFor === partyId;
  return {
    items,
    units,
    lastLines: mine ? lastLines : null,
    lastFrom: mine ? lastFrom : null,
  };
}

/**
 * 他在「是什么」那一格挑了一件货 —— 把单位跟单价填进**空的**那几格。
 *
 * 🔴 已经打了字的一格不动（[任务 144]）。回传 undefined = 没有这件货，
 * 那就是他自己打的一句话（「拆除旧厨房」不在任何人的货架上），什么都不做。
 */
export function fillFromShelf(line: Line, items: ShelfItem[] | null): Partial<Line> | undefined {
  const hit = (items ?? []).find((i) => i.name === line.description);
  if (!hit) return undefined;
  const patch: Partial<Line> = {};
  if (!line.unit.trim() && hit.unit) patch.unit = hit.unit;
  if (!line.unitPrice.trim() && hit.priceCents != null) patch.unitPrice = priceText(hit.priceCents);
  return Object.keys(patch).length ? patch : undefined;
}
