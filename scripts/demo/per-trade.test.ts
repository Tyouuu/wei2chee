import { it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { buildPageLayout, type BusinessContext } from "@/lib/templates/industry-template";

/* ONE BUSINESS PER REGISTER, WHICH IS THE POINT.
   Founder, 2026-08-27: 「你不能每一套都拿这个装修业当demo啊」. Every render this
   session put the same renovation contractor, the same photographs and the
   same three services through all six registers -- so the only thing varying
   was the skeleton, and six pages of identical content necessarily read alike.
   A register is FOR a trade; demonstrating it against somebody else's trade
   shows it at its worst. */
const TRADE: Record<string, { style: string; name: string; ctx: BusinessContext }> = {
  hearth: {
    style: "hearth",
    name: "Ivy Hair & Nails",
    ctx: { industry: { slug: "beauty", name_zh: "美容/沙龙", labels: { customer: "客户", order: "预约", staff: "美容师" }, default_workflow: ["Customer", "Booking", "Service", "Payment"], suggested_modules: ["Customer", "Booking", "Payment"] } },
  },
  ledger: {
    style: "ledger",
    name: "Xingfa Renovation",
    ctx: { industry: { slug: "renovation", name_zh: "装修/承包商", labels: { customer: "客户", order: "项目", staff: "师傅" }, default_workflow: ["Customer", "Quotation", "Deposit", "Project"], suggested_modules: ["Customer", "Quotation", "Project", "Payment"] } },
  },
  signboard: {
    style: "signboard",
    name: "Ah Seng Trading",
    ctx: { industry: { slug: "retail", name_zh: "零售/门店", labels: { customer: "客户", order: "订单", staff: "店员" }, default_workflow: ["Customer", "Order", "Payment"], suggested_modules: ["Customer", "Order", "Payment"] } },
  },
  swiss: {
    style: "swiss",
    name: "Meridian Advisory",
    ctx: { industry: { slug: "services", name_zh: "服务型公司", labels: { customer: "客户", order: "案子", staff: "顾问" }, default_workflow: ["Customer", "Proposal", "Engagement", "Invoice"], suggested_modules: ["Customer", "Quotation", "Payment"] } },
  },
  counter: {
    style: "counter",
    name: "Hup Lee Supply",
    ctx: { industry: { slug: "wholesale", name_zh: "批发/分销", labels: { customer: "客户", order: "订单", staff: "员工" }, default_workflow: ["Customer", "Order", "Delivery", "Payment"], suggested_modules: ["Customer", "Order", "Payment"] } },
  },
  blueprint: {
    style: "blueprint",
    name: "Bright Minds Tuition",
    ctx: { industry: { slug: "education", name_zh: "教育/补习", labels: { customer: "家长", order: "报名", staff: "老师" }, default_workflow: ["Customer", "Enrolment", "Class", "Payment"], suggested_modules: ["Customer", "Booking", "Payment"] } },
  },
};

const PHOTOS = JSON.parse(readFileSync(".screenshots/photos/trade-photos.json", "utf8")) as Record<string, Record<string, string>>;

/* ── 作品墙放几张，照它自己那一页 ──────────────────────────────────────────
   Ten was tried for every register on 2026-08-28 and it fixed two while
   breaking two: 満図 and 台账 went to zero differences, and 图纸 — whose
   reference carries SEVEN photographs on the whole page — went to twelve, while
   中台's page went from 5540px to 9005px against their 5259.

   A count is not a constant. Measured, per reference:

       台账 Recent Projects 10 · 中台 18 across the page · 瑞士 12 ·
       図纸 7 in total · 招牌 14 · 満図 9

   so the gallery carries what its own page carries and nothing else. */
const SHOTS: Record<string, number> = {
  renovation: 10, // 照片张数 10 对他们 15；格子有上限之后十张不会再撑爆
  beauty: 6,      // 満図 ← A. Reynolds: its photographs live in the argument
  services: 6,  // 第5段 1413 对他们 611 —— 九张把作品墙撑成两倍
  education: 3,   // 図纸 ← Parker & Brown: seven on the whole page
  retail: 6,      // 招牌 ← Toulouse: Moments is six
  wholesale: 6,   // 中台 ← Kurofude: pairs, not a wall
};

function fill(nodes: any[], P: Record<string, string>, shots = 6) {
  for (const n of nodes ?? []) {
    const id = String(n?.props?.id ?? "");
    if (id === "website-hero") { n.props.photo = P.hero; n.props.photoAlt = ""; }
    if (id === "website-work") {
      /* ── 十张，不是六张 ──────────────────────────────────────────────────
         Six was chosen because 大图马赛克 repeats its tile pattern every six and
         a seventh opened a hole in the last row — a layout reason, and it left
         the page with less material than every reference it copies. Measured
         2026-08-28: 台账's Recent Projects carries ten photographs, 中台's page
         eighteen, 瑞士's twelve; ours came out at eight and nine, which is most
         of why our pages run shorter than theirs.

         Ten keeps the pattern whole (six plus a full second row of four) and
         the extra four repeat the trade's own set, which is what a placeholder
         is for — 「要嘛你就是去图库拿图 要嘛只是一个占位图 都可以」. */
      n.props.items = [P.big, P.g1, P.g2, P.g3, P.strip, P.hero, P.g4, P.story, P.g1, P.g2]
        .filter(Boolean)
        .slice(0, shots)
        .map((src) => ({ src, alt: "" }));
    }
    if (id === "website-band") { n.props.photo = P.strip; n.props.photoAlt = ""; }
    /* 四点两栏 and 半块颜色 both take photographs and neither was being fed --
       满图 declines the gallery, so on that register g1/g2/story had nowhere to
       go and the page rendered four pictures against the reference's nine.
       Wix's 装修 page puts one picture inside each column of 「Why Choose Us」
       and one beside its mid-page panel; these are those three. */
    /* 四张：三栏各一张，加底下那张满边的。两张是给「四点两栏」那个形状的，
       三栏那个形状（Toulouse 的 This Month）第三栏就空着，而空的那一格在一段
       只有三栏的设计里非常显眼。 */
    if (id === "website-woven") { n.props.photos = [P.g1, P.g2, P.g3, P.strip].filter(Boolean); }
    if (id === "website-cta") { n.props.photo = P.story; n.props.photoAlt = ""; }
    /* 清单配照片 stands the services beside a picture, and 大图马赛克 wants more
       than three: 台账's reference runs TEN in that slot. Both are slots that
       had no wire, which is how 満図's woven section shipped empty. */
    /* Not P.strip -- that one is a texture (brickwork), and beside a list of
       services a texture says nothing. The story shot is a person working. */
    /* Distinct shots per slot. Before this, P.story went to the story block,
       the services list AND the mosaic -- the same hammer on the same planks
       three times down one page, which reads as a business with one photo. */
    if (id === "website-services") {
      n.props.photo = P.g4 || P.hero;
      n.props.photoAlt = "";
      /* 菜单式那个形状每一项自己一张照片，三张高矮不一 —— 那是 Toulouse 那一段
         的节奏。没有照片的位子画一张同样大小的占位。 */
      if (Array.isArray(n.props.items)) {
        const shots = [P.g1, P.g2, P.g3, P.big].filter(Boolean);
        n.props.items = n.props.items.map((it: any, i: number) => ({ ...it, photo: shots[i % shots.length] }));
      }
    }
    if (id === "website-story") { n.props.photo = P.story; n.props.photoAlt = ""; n.props.body = "The same team that quotes is the team that turns up, and we tell you what it costs before we start."; }
    /* 评价的头像是照片，不是字母。
       Founder, 2026-08-28: 「照片我要看」. Five of the six references put a round
       PHOTOGRAPH at the top of each testimonial — Betty Downey, James T.
       O'Reilly, Tom Levis on A. Reynolds — and ours drew the first letter of
       the name in a coloured circle. Three photographs per page, which is most
       of the gap the ruler kept reporting as 「照片张数 模版 9 · 我们 5」 without
       anything saying where the four had gone. */
    /* ── 别人给的证明，要有东西才看得到那一段 ──────────────────────────────
       瑞士's reference runs an 「As Seen On」 band — a pale grey strip with four
       logo tiles — as its FOURTH section. Ours rendered nothing there, because
       SiteCreds drops itself while it is empty (编辑器负责催，公开的页面永远不出现
       「催」), so the whole section vanished and every section below it read one
       slot out of step: 我们第4段 was the dark work band against their grey.

       These are marked `placeholder`, which is what keeps the rule intact — a
       demo page shows the SHAPE of the section, and publish-projection still
       drops the block on a real customer's site until they fill it in. */
    if (id === "website-creds" && Array.isArray(n.props.items) && !n.props.items.some((x: any) => x?.label?.trim())) {
      n.props.items = [
        /* ⚠️ NOT marked `placeholder`. That flag is precisely what
           publish-projection uses to drop the block, and align renders the
           PUBLIC page — so the first version of this seed left the section
           invisible for exactly the reason it was invisible before. These four
           are true of the demo business and of nothing else; a real customer's
           block is still empty until they fill it. */
        { label: "10 years", note: "In this trade" },
        { label: "Klang Valley", note: "Where we work" },
        { label: "Written quotes", note: "Before any work" },
        { label: "Same team", note: "Quote to finish" },
      ];
    }
    if (id === "website-reviews" && Array.isArray(n.props.items)) {
      const faces = [P.g1, P.g2, P.g3, P.story].filter(Boolean);
      n.props.items = n.props.items.map((t: any, i: number) => ({ ...t, face: faces[i % faces.length] }));
    }
    for (const v of Object.values(n?.props ?? {})) if (Array.isArray(v)) fill(v as any[], P, shots);
  }
}

it("writes one page per register, each for its own trade", () => {
  const out: Record<string, unknown> = {};
  for (const [key, t] of Object.entries(TRADE)) {
    const l = buildPageLayout("website", t.ctx, t.name, "en", undefined, t.style) as any;
    /* `industry` is optional on BusinessContext -- a project can exist before
       the analysis has decided a trade. Every entry in TRADE above sets one,
       but the type does not know that, and `next build` type-checks this file
       while `tsc --noEmit` here did not: two deployments failed on it before
       the difference was noticed. */
    const slug = t.ctx.industry?.slug ?? "";
    fill(l.content, PHOTOS[slug] ?? {}, SHOTS[slug] ?? 6);
    out[key] = l;
  }
  writeFileSync(".screenshots/photos/per-trade.json", JSON.stringify(out));
  expect(Object.keys(out).length).toBe(6);
});
