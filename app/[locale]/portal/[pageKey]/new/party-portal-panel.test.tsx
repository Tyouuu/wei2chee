import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PartyPortalPanel, type PartyRequest } from "./party-portal-panel";
import { RECORD_COPY } from "../record-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ rpc: async () => ({ error: null }) }),
}));

/**
 * 一颗按下去一定失败的按钮，比没有那颗按钮更糟。
 *
 * ── 这一条守的是什么 ──────────────────────────────────────────────────────
 *
 * 「开成一张单」走 `record_from_request(request, module_key)`，而那支函式
 * 要一个**这门生意真的有的**走单页。一个只开了库存跟收款的系统里没有那一页 ——
 * 那时候画那颗按钮，他按下去拿到的是一句资料库的话。
 *
 * ⚠️ **为什么用元件测试而不是浏览器**：`shoot:party-portal` 那个用完就删的
 * 帐号**开局就有报价单跟订单两页**，所以「一页都没有」那个状态在那里造不出来。
 * 🔴 而它本来在那把尺上是**因为我写坏了才过的** —— `sort_order` 写成
 * `position`，整个查询报错、静静回 null，於是那颗按钮永远不画。
 * 一条因为产品坏了而变绿的断言，比没有那一条更糟。
 */

const copy = RECORD_COPY.en.form;
const one: PartyRequest[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    what: "Keep me 200 cards from the next batch",
    qty: 200,
    amountCents: 500000,
    contact: "017-873 0408",
    status: "open",
    docNo: null,
    createdAt: "2026-09-05T02:00:00Z",
  },
];

const render = (
  landsIn: string | null,
  landsInLabel: string | null,
  requests = one,
) =>
  renderToStaticMarkup(
    <PartyPortalPanel
      partyId="22222222-2222-4222-8222-222222222222"
      portalRef="33333333-3333-4333-8333-333333333333"
      origin="https://example.test"
      requests={requests}
      landsIn={landsIn}
      landsInLabel={landsInLabel}
      copy={copy}
    />,
  );

describe("PartyPortalPanel", () => {
  it("一页放得下单的都没有的时候，不画那颗按钮", () => {
    const html = render(null, null);
    expect(html).not.toContain("Open it as");
  });

  it("而且讲得出为什么，不是一片空白", () => {
    expect(render(null, null)).toContain(copy.portalNowhere);
  });

  it("有那一页的时候，那颗按钮用他自己给那一页取的名字", () => {
    const html = render("orders", "Job sheets");
    expect(html).toContain("Open it as Job sheets");
    expect(html).not.toContain(copy.portalNowhere);
  });

  it("他自己讲的那句话原样画出来", () => {
    expect(render("orders", "Orders")).toContain(
      "Keep me 200 cards from the next batch",
    );
  });

  it("已经开成单的那一笔不再给按第二次", () => {
    const done: PartyRequest[] = [
      { ...one[0], status: "done", docNo: "OR-2026-0007" },
    ];
    const html = render("orders", "Orders", done);
    expect(html).not.toContain("Open it as");
    expect(html).toContain("OR-2026-0007");
  });

  it("那条连结是他发得出去的完整网址", () => {
    expect(render("orders", "Orders")).toContain(
      "https://example.test/p/33333333-3333-4333-8333-333333333333",
    );
  });

  it("🔴 一个 id 都不画在他要发出去的那一段上", () => {
    /* 门牌是 portal_ref，不是那一行的 id —— 一个印出来的 id 是收不回来的。 */
    const html = render("orders", "Orders");
    expect(html).not.toContain("22222222-2222-4222-8222-222222222222");
  });

  it("还没开连结的时候只有一颗「开一条」，没有那个网址框", () => {
    const html = renderToStaticMarkup(
      <PartyPortalPanel
        partyId="22222222-2222-4222-8222-222222222222"
        portalRef={null}
        origin="https://example.test"
        requests={[]}
        landsIn="orders"
        landsInLabel="Orders"
        copy={copy}
      />,
    );
    expect(html).toContain(copy.portalOpen);
    expect(html).not.toContain("https://example.test/p/");
  });
});
