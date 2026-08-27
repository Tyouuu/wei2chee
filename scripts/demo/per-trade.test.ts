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

function fill(nodes: any[], P: Record<string, string>) {
  for (const n of nodes ?? []) {
    const id = String(n?.props?.id ?? "");
    if (id === "website-hero") { n.props.photo = P.hero; n.props.photoAlt = ""; }
    if (id === "website-work") {
      /* Six, because 大图马赛克 repeats its tile pattern every six and a
         seventh opens a hole in the last row. */
      n.props.items = [P.big, P.g1, P.g2, P.g3, P.strip, P.hero]
        .filter(Boolean)
        .map((src) => ({ src, alt: "" }));
    }
    if (id === "website-band") { n.props.photo = P.strip; n.props.photoAlt = ""; }
    /* 四点两栏 and 半块颜色 both take photographs and neither was being fed --
       满图 declines the gallery, so on that register g1/g2/story had nowhere to
       go and the page rendered four pictures against the reference's nine.
       Wix's 装修 page puts one picture inside each column of 「Why Choose Us」
       and one beside its mid-page panel; these are those three. */
    if (id === "website-woven") { n.props.photos = [P.g1, P.g2].filter(Boolean); }
    if (id === "website-cta") { n.props.photo = P.story; n.props.photoAlt = ""; }
    /* 清单配照片 stands the services beside a picture, and 大图马赛克 wants more
       than three: 台账's reference runs TEN in that slot. Both are slots that
       had no wire, which is how 満図's woven section shipped empty. */
    /* Not P.strip -- that one is a texture (brickwork), and beside a list of
       services a texture says nothing. The story shot is a person working. */
    /* Distinct shots per slot. Before this, P.story went to the story block,
       the services list AND the mosaic -- the same hammer on the same planks
       three times down one page, which reads as a business with one photo. */
    if (id === "website-services") { n.props.photo = P.g4 || P.hero; n.props.photoAlt = ""; }
    if (id === "website-story") { n.props.photo = P.story; n.props.photoAlt = ""; n.props.body = "The same team that quotes is the team that turns up, and we tell you what it costs before we start."; }
    for (const v of Object.values(n?.props ?? {})) if (Array.isArray(v)) fill(v as any[], P);
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
    fill(l.content, PHOTOS[t.ctx.industry?.slug ?? ""] ?? {});
    out[key] = l;
  }
  writeFileSync(".screenshots/photos/per-trade.json", JSON.stringify(out));
  expect(Object.keys(out).length).toBe(6);
});
