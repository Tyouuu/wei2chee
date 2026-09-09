/* 一个价钱只有一个真相。
 *
 * 2026-08-31：老板要我逐个画面去研究，裁开登入页一看，它印着
 * 「RM5,000 to build, then RM100–300/month hosting」—— 那是 2026-08-25
 * **已经改掉**的定价（任务 9）。
 * 官网改了，登入页没改，需求书没改，而最糟的是 **opengraph 那张卡**没改 ——
 * 那是别人把连结贴进 WhatsApp 时跳出来的图，**它比官网更早被看到**。
 *
 * 一个价钱散在四个地方，改的时候只会记得走得到的那几个。
 * 这支测试守的是：**旧的数字不准再出现在任何客户看得到的字里**。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = ["messages/en.json", "messages/zh.json", "app/[locale]/opengraph-image.tsx"];

/* 旧定价的每一种写法。要再改价钱，就把新的旧值加进来。
   ⚠️ RM199 是 2026-09-01 退役的 —— 老板定成 RM150（原话：「每个月150吧」）。
   它退役得特别值得盯：它同时印在官网、登入页、需求书跟 WhatsApp 那张卡上，
   而上一次改价钱正好漏掉那张卡。 */
const RETIRED = [
  /RM ?5,000/,
  /RM ?100[–-]300/,
  /RM ?199/,
  /* 🔴 2026-09-06 退役：规格书 RM 500 ＋ 按模块的开发费 ＋ 月费 RM 150。
     老板看着需求书上那张表：`都不要了 跟著新概念` ——
     概念 9-03 就换成**建置 RM 1,500 ＋ 年费 RM 1,500**（[任务 109]），
     而官网 · 登入页 · 那张 WhatsApp 卡印了三天上一套。
     ⚠️ 「按模块」那两种写法也进来：一个作废的**收费方式**跟一个作废的
     **数字**一样会误导，而它不是一个数字，正则搜不到。 */
  /* ⚠️ 后面那个「不是数字」很要紧：`RM 500` 会配上
     **`RM 500,000`** —— 而那是 SST 的登记门槛，不是我们的价钱。
     税那一页写着它，第一版当场把一句对的话判红了。 */
  /RM ?500(?![\d,])/,
  /RM ?150(?![\d,])/,
  /*
    🔴 2026-09-09 这两条各红过一次，而**红的不是定价，是一个例子**：
    助手输入框那句 `记一笔 RM 500 水泥` —— 那是他自己花的钱，不是我们收的钱。

    修的方式是**把例子里的数字换掉**（改成 RM 180），不是替这把尺开一个例外。
    理由：一条有例外的守卫，跟一条什么都没守的守卫，隔的只是下一个人
    把例外再放宽一点。而换一个例子的数字，一分钱都不值。

    → **以后写任何示例文案，先扫一眼上面这张退役清单。**
       例子用哪个数字都行，唯独不能用我们收过的那几个。
  */
  /priced by module/i,
  /按模块计/,
];

describe("定价只有一个真相", () => {
  for (const f of FILES) {
    it(`${f} 里没有已经作废的价钱`, () => {
      const src = readFileSync(resolve(f), "utf8");
      for (const re of RETIRED) {
        const hit = src.match(re);
        expect(hit, `${f} 还印着 ${hit?.[0]} —— 那是已经作废的定价`).toBeNull();
      }
    });
  }

  it("现行定价的数字都还在（免得有人整段删掉就算过）", () => {
    for (const f of ["messages/en.json", "messages/zh.json"]) {
      const src = readFileSync(resolve(f), "utf8");
      /* 建置一次，之后每一年 —— 两个都是 RM 1,500，所以至少要出现两次。 */
      expect(src.match(/RM ?1,500/g)?.length ?? 0, `${f} 里没有现行的价钱`).toBeGreaterThan(1);
    }
  });
});

/* 价钱旁边不准出现我们还没有的功能。
 *
 * 2026-09-01：托管那一档底下写着「LHDN e-Invoice 的更新」。
 * 查了产品这边 —— **一行都没有**：`20260830050000` 那支迁移自己写着
 * 「We do not file e-Invoices」，全仓库没有任何送件的路径。
 * 那句话是 8-25 就在的旧文案，而**我 9-01 把它从一整段文字提成一个打勾**，
 * 等於把一个不成立的宣称讲得更大声。
 *
 * ⚠️ [任务 71](../../docs/founder-tasks.md)：e-Invoice **要做，只是排在后面**。
 * 所以这条守的不是「永远不准提」，是**「做出来之前不准写在价目上」** ——
 * 真的做好了，把 `hasEInvoice` 那一行改成 true，这条自己让路。
 *
 * ⚠️ 公告胶囊里那句「LHDN e-Invoice：已强制」不在这条管辖内，
 * 那讲的是**法律**，不是我们的功能。所以只查价钱那一段。
 */
describe("价目上不准卖还没做的东西", () => {
  const hasEInvoice = false; // 做好了改这里，这条测试就自己让路
  for (const f of ["messages/en.json", "messages/zh.json"]) {
    it(`${f} 的价钱步骤里没有 e-Invoice`, () => {
      if (hasEInvoice) return;
      const msgs = JSON.parse(readFileSync(resolve(f), "utf8"));
      const steps = JSON.stringify(msgs.explainer?.price?.steps ?? []);
      expect(
        /e-?invoice|myinvois/i.test(steps),
        `${f} 的价目在卖 e-Invoice，而产品里一行都没有`,
      ).toBe(false);
    });
  }
});
