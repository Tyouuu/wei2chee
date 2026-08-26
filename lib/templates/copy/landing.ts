import type { SystemLang } from "@/lib/system-lang";

/**
 * The words on 官网 -- the only page in the system whose reader is a stranger.
 *
 * This table is held to a different standard than the rest of the copy in this
 * directory. Everywhere else a clumsy phrase is a wart on the owner's own
 * screen; here it is what a prospective customer reads before deciding whether
 * to message. So: concrete nouns, no adjectives, and a promise the business can
 * actually be held to.
 *
 * The English side is the DEFAULT (see lib/system-lang.ts) and is the version
 * most of these businesses would actually put on a website -- a Klang Valley
 * contractor's site is in English even when every conversation on the job is
 * in Chinese or Malay.
 */

export type ServiceHint = { label: string; value: string; icon: string };

export type LandingCopy = {
  /** "Malaysia · Renovation" -- the trade name only, no slash. Several trades
   *  are stored as 「装修/承包商」 and an eyebrow reading the whole field looks
   *  like a database column, not like a business. */
  eyebrowPrefix: string;
  /** The trade as a short LABEL for the eyebrow, per slug. */
  eyebrowTrade: Record<string, string>;
  eyebrowTradeFallback: string;
  /** The trade as it reads in a sentence. `name_zh` is fine for Chinese;
   *  English needs its own, because "Renovation / Contractor runs on..." does
   *  not parse. */
  tradeNoun: Record<string, string>;
  tradeNounFallback: string;
  /** One line of what the business promises. A concrete commitment, not an
   *  adjective: "Reliable and professional" says nothing, "We come and look
   *  before we quote, and you pay the balance when it is done" is something a
   *  stranger can hold them to -- which is what makes them message. */
  promise: Record<string, string>;
  /** What each trade sells, in three lines. A stranger scanning a page decides
   *  from nouns, not adjectives. Every one of these is meant to be retyped by
   *  the owner; the point is that the page is never blank and never
   *  generic-agency. */
  services: Record<string, ServiceHint[]>;
  /** The three figures under the headline. Placeholders that are obviously
   *  placeholders, in the units this trade would actually use. */
  proof: { value: string; label: string }[];
  /**
   * Contact rows, EVERY ONE OF WHICH IS A PLACEHOLDER.
   *
   * `placeholder: true` is not documentation. publish-projection.ts drops any
   * row carrying it, so these reach the owner in the editor and never reach a
   * stranger. Found on the live site: a real business's public page was
   * printing 「WhatsApp 012-345 6789」 and 「Taman Desa, Kuala Lumpur」 -- a phone
   * number that is not theirs and may well be somebody else's, and an address
   * that is not where they are. That is not a design defect; it is publishing
   * false contact details for a real business.
   */
  contact: { label: string; value: string; icon: string; placeholder?: boolean }[];
  /** Joins the three service labels into the pitch line. Chinese uses the
   *  enumeration comma; English uses a serial list. */
  joinServices: (labels: string[]) => string;

  /**
   * The words the six 官网 templates write onto the page itself.
   *
   * Deliberately NOT the same as the template's `label` and `blurb` in
   * landing-templates.ts. Those two name the template in 模板库, which is
   * Formae's own screen and is read by the OWNER -- so they stay Chinese
   * whatever language the website is in. Everything below is read by a
   * stranger.
   */
  page: {
    /** The two hero actions. WhatsApp is primary because in this market it is
     *  the channel a stranger actually uses. */
    /** One word marking the hero figure as an example. The figure draws the
     *  document this business sends -- with a total on it -- on a page a
     *  stranger reads, so it has to say out loud that it is a picture of the
     *  paperwork and not a real quotation. */
    /** Two or three characters for a CHIP, not a sentence for a button.
     *  The hero figure's price chips first reused `whatsapp` and came out
     *  reading 「Ask on WhatsApp」 inside a 60px pill. A label and a call to
     *  action are different lengths of the same idea and need separate words. */
    askShort: string;
    sampleLabel: string;
    whatsapp: string;
    /** In front of the printed number in the hero. Two or three characters --
     *  it sits on the same line as a 21px figure. */
    callUs: string;
    /** One word, beside the floating button's icon. */
    whatsappShort: string;
    /** Pre-filled into the chat, so the owner is not opening a blank thread. */
    whatsappFirstLine: string;
    seeWork: string;
    contactHeading: string;
    /** Under the submit button. A promise about response time, so it has to be
     *  one the business can keep. */
    replyNote: string;
    /** The arrow line -- the only place on the page where this product's own
     *  claim is visible. Three pieces because the business's page name sits
     *  between them and Chinese and English do not put it in the same place. */
    arrowBadge: string;
    arrowBefore: string;
    arrowAfter: string;
    fields: { label: string; placeholder: string; kind: string }[];
    /** Per template key: the section headings and the form's own wording. */
    byTemplate: Record<
      string,
      {
        services: string;
        flow?: string;
        formHeading: string;
        formBlurb: string;
        submit: string;
      }
    >;
    /**
     * THE SIX SECTIONS A MALAYSIAN SME PAGE NEEDS AND THIS ONE DID NOT HAVE.
     *
     * The founder's own list, written before any of this was built: 「下一个真正
     * 的洞是版段太少 —— 一页只有 hero/服务/流程/表单/联络五种。缺的是口碑、价目、
     * 覆盖范围、常见问题、营业时间、保证。」
     *
     * Every one of them is a question a stranger asks before they message, and
     * a page that does not answer them sends the stranger to WhatsApp to ask --
     * which is one more reason not to bother. They are also, all six, things the
     * imported American SaaS templates do not have, because a US software
     * company is not asked 「你们做不做 Cheras」.
     *
     * WHAT IS DELIBERATELY BLANK. Prices are 「RM —」 and the photo frames are
     * empty. A page that invents a price is a page that lies to a stranger, and
     * a page filled with stock photos of somebody else's kitchen announces that
     * nobody designed it. Both render as an obvious, sized, labelled gap that
     * the owner fills -- which is the same standard the rest of this file holds:
     * never blank, never generic-agency, never WRONG.
     */
    sections: {
      work: { heading: string; hint: string; shots: string[] };
      areas: { heading: string; note: string; list: string[] };
      prices: { heading: string; note: string; askLabel: string; blank: string };
      /** The middle ask. Its own words, not the price note's -- the first
       *  version of this block borrowed 「A guide, not a quote」 and asked
       *  nobody anything. */
      cta: { heading: string; note: string };
      reviews: { heading: string; note: string; quotes: { text: string; who: string }[] };
      faq: { heading: string; rows: { title: string; body: string }[] };
      hours: { heading: string; rows: { label: string; value: string }[] };
      promiseList: { heading: string; marks: string[] };
    };
  };
};

const EN: LandingCopy = {
  eyebrowPrefix: "Malaysia",
  eyebrowTrade: {
    renovation: "Renovation & fitout",
    retail: "Retail",
    beauty: "Beauty & salon",
    wholesale: "Wholesale",
    services: "Professional services",
    fnb: "Food & beverage",
    education: "Tuition",
    other: "Small business",
  },
  eyebrowTradeFallback: "Small business",
  tradeNoun: {
    renovation: "renovation business",
    retail: "shop",
    beauty: "salon",
    wholesale: "trading business",
    services: "services firm",
    fnb: "restaurant",
    education: "tuition centre",
    other: "business",
  },
  tradeNounFallback: "business",
  promise: {
    renovation: "We come and look before we quote, and you settle the balance when it is done.",
    beauty: "We tell you what is being done and what it costs before we start.",
    fnb: "Order on WhatsApp, we message you when it is ready.",
    retail: "In stock goes home today; what is not, we order in.",
    wholesale: "Cartons or pallets, and a separate price for volume.",
    education: "First class is a trial. If it does not suit, you stop there.",
    services: "We quote first. Nothing starts until you agree to it.",
    other: "We agree what it is first, then we start.",
  },
  services: {
    renovation: [
      { label: "Home renovation", value: "3-room, shoplot, old-house rework", icon: "work" },
      { label: "Kitchen / bathroom", value: "Hacking, waterproofing, tiles, cabinets", icon: "work" },
      { label: "Commercial fitout", value: "Shopfronts, offices, restaurants", icon: "company" },
    ],
    beauty: [
      { label: "Cut / colour", value: "Cut, colour, treatment", icon: "person" },
      { label: "Facial & body", value: "Facial and body treatments", icon: "person" },
      { label: "Bridal", value: "Trial plus on-the-day touch-ups", icon: "tag" },
    ],
    fnb: [
      { label: "Dine-in", value: "House specials, set meals", icon: "company" },
      { label: "Takeaway / delivery", value: "Order on WhatsApp", icon: "phone" },
      { label: "Functions & catering", value: "Birthdays, company events", icon: "date" },
    ],
    retail: [
      { label: "In stock", value: "What you can walk out with", icon: "tag" },
      { label: "Order in", value: "What we can bring in for you", icon: "file" },
      { label: "Trade price", value: "Separate price for volume", icon: "money" },
    ],
    wholesale: [
      { label: "Wholesale supply", value: "By carton, by pallet", icon: "company" },
      { label: "Terms", value: "Monthly terms for regular accounts", icon: "money" },
      { label: "Delivery", value: "Own lorries within Klang Valley", icon: "place" },
    ],
    education: [
      { label: "Tuition classes", value: "Small group or one-to-one", icon: "person" },
      { label: "Subjects", value: "By subject, by year", icon: "file" },
      { label: "Trial class", value: "First class is a trial", icon: "date" },
    ],
    services: [
      { label: "On-site service", value: "We come to you, by appointment", icon: "place" },
      { label: "Repair / servicing", value: "Quoted before any work starts", icon: "work" },
      { label: "Ongoing contracts", value: "Monthly or yearly", icon: "file" },
    ],
    other: [
      { label: "Main service", value: "Change this to the first thing you do", icon: "work" },
      { label: "Second service", value: "Change this to the second", icon: "file" },
      { label: "Third service", value: "Change this to the third", icon: "tag" },
    ],
  },
  proof: [
    { value: "10 years", label: "In this trade" },
    { value: "24 hours", label: "To reply" },
    { value: "Klang Valley", label: "We cover" },
  ],
  contact: [
    { label: "WhatsApp", value: "012-345 6789", icon: "phone", placeholder: true },
    { label: "Address", value: "Taman Desa, Kuala Lumpur", icon: "place", placeholder: true },
    { label: "Opening hours", value: "Mon–Sat 9am–6pm", icon: "time", placeholder: true },
  ],
  // Only the first item keeps its capital. These are section LABELS being reused
  // inside a sentence, and "Home renovation, Kitchen / bathroom and Commercial
  // fitout" reads like three headings glued together -- which is exactly what it
  // was, on the first English render of a real page.
  joinServices: (labels) => {
    const list = labels.map((l, i) => (i === 0 ? l : l.toLowerCase()));
    return list.length > 1
      ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`
      : (list[0] ?? "");
  },

  page: {
    askShort: "Ask price",
    sampleLabel: "Example",
    whatsapp: "Ask on WhatsApp",
    /* The three words the FIRST SCREEN needs, added 2026-08-26 with the printed
       number and the floating button. Short on purpose: 「Call us」 sits in front
       of a number, and the floating pill has room for one word beside its icon. */
    callUs: "Call us",
    whatsappShort: "WhatsApp",
    whatsappFirstLine: "Hi, I saw your website and I would like to ask about",
    seeWork: "See our work",
    contactHeading: "How to reach us",
    replyNote: "Usually answered within a day.",
    arrowBadge: "automatic",
    arrowBefore: "Send this and your system opens a ",
    arrowAfter: " — nobody has to retype it.",
    fields: [
      { label: "Your name", placeholder: "Mr Tan", kind: "text" },
      { label: "Phone / WhatsApp", placeholder: "012-345 6789", kind: "phone" },
      {
        label: "What do you need?",
        placeholder: "3-room renovation, roughly how much?",
        kind: "long",
      },
    ],
    byTemplate: {
      quote: {
        services: "What we do",
        flow: "What happens after you call",
        formHeading: "Leave a number and we will come back to you",
        formBlurb:
          "Three fields is all. We reply on WhatsApp — no cold calls.",
        submit: "Send",
      },
      booking: {
        services: "What we offer",
        flow: "How to book",
        formHeading: "When would suit you?",
        formBlurb: "Leave a number and a time. We confirm and come back to you.",
        submit: "Request a slot",
      },
      order: {
        services: "What we have",
        formHeading: "What would you like?",
        formBlurb: "Write it down and we will get it ready.",
        submit: "Place order",
      },
      wholesale: {
        services: "What we supply",
        flow: "How we work together",
        formHeading: "Need a quote?",
        formBlurb: "Tell us what and roughly how much, and we will price it.",
        submit: "Request a quote",
      },
      portfolio: {
        services: "What we have made",
        flow: "How we work",
        formHeading: "Something in mind?",
        formBlurb: "Tell us what you are thinking and we will reply.",
        submit: "Send",
      },
      card: {
        services: "What we do",
        formHeading: "Get in touch",
        formBlurb: "",
        submit: "Send",
      },
    },
    sections: {
      work: {
        heading: "Our work",
        hint: "Put your own photos here — three of your best jobs.",
        shots: ["Add a photo", "Add a photo", "Add a photo"],
      },
      areas: {
        heading: "Where we cover",
        note: "Outside these? Message us anyway — we travel for the right job.",
        list: ["Kuala Lumpur", "Petaling Jaya", "Subang / USJ", "Shah Alam", "Puchong", "Cheras", "Klang", "Ampang"],
      },
      cta: {
        heading: "Tell us what you need and we will come and look",
        note: "No charge for the visit, and no obligation after it.",
      },
      prices: {
        heading: "What it costs",
        note: "A guide, not a quote. The real number comes after we look.",
        askLabel: "Ask",
        blank: "RM —",
      },
      reviews: {
        heading: "What customers say",
        note: "Replace these with your own — a screenshot of a Google review works too.",
        quotes: [
          { text: "Came when they said they would, and the price did not move.", who: "A customer" },
          { text: "Explained what could wait and what could not. Saved us money.", who: "A customer" },
        ],
      },
      faq: {
        heading: "Questions we get",
        rows: [
          { title: "How long before you reply?", body: "Within a day, usually the same afternoon." },
          { title: "Do you charge to come and look?", body: "No. We look, then we quote." },
          { title: "How do payments work?", body: "A deposit to start, the balance when the work is done and you are happy with it." },
          { title: "Can you give a price over WhatsApp?", body: "A rough range, yes. The real number needs a look." },
        ],
      },
      hours: {
        heading: "When we are open",
        rows: [
          { label: "Mon – Fri", value: "9:00am – 6:00pm" },
          { label: "Saturday", value: "9:00am – 1:00pm" },
          { label: "Sunday & public holidays", value: "Closed" },
          { label: "WhatsApp", value: "Any time — we reply in working hours" },
        ],
      },
      promiseList: {
        heading: "What you get from us",
        marks: [
          "A written quote before anything starts",
          "One person you deal with from start to finish",
          "No charge for coming to look",
          "We tell you before anything costs more",
        ],
      },
    },
  },
};

const ZH: LandingCopy = {
  eyebrowPrefix: "马来西亚",
  eyebrowTrade: {
    renovation: "装修",
    retail: "零售",
    beauty: "美容",
    wholesale: "批发",
    services: "服务型公司",
    fnb: "餐饮",
    education: "教育",
    other: "其他",
  },
  eyebrowTradeFallback: "其他",
  tradeNoun: {
    renovation: "装修公司",
    retail: "店",
    beauty: "沙龙",
    wholesale: "贸易公司",
    services: "服务型公司",
    fnb: "餐厅",
    education: "补习中心",
    other: "生意",
  },
  tradeNounFallback: "生意",
  promise: {
    renovation: "报价前先上门看，做完才收尾款。",
    beauty: "先讲清楚做什么、多少钱，才动手。",
    fnb: "WhatsApp 落单，做好通知你来拿。",
    retail: "现货当天拿，没货的可以订。",
    wholesale: "整箱整板都有，量大另外报价。",
    education: "第一堂可以先试，不合适不用继续。",
    services: "先报价，你同意了才开工。",
    other: "先讲清楚，再开工。",
  },
  services: {
    renovation: [
      { label: "住宅翻新", value: "三房、店屋、旧屋翻新", icon: "work" },
      { label: "厨房 / 浴室", value: "拆旧、防水、瓷砖、橱柜", icon: "work" },
      { label: "商业装修", value: "店面、办公室、餐厅", icon: "company" },
    ],
    beauty: [
      { label: "剪发 / 染发", value: "剪、染、护理", icon: "person" },
      { label: "美容护理", value: "脸部、身体护理", icon: "person" },
      { label: "新娘造型", value: "试妆 + 当天跟妆", icon: "tag" },
    ],
    fnb: [
      { label: "堂食", value: "招牌菜、套餐", icon: "company" },
      { label: "外带 / 外送", value: "WhatsApp 落单", icon: "phone" },
      { label: "包场 / 到会", value: "生日、公司活动", icon: "date" },
    ],
    retail: [
      { label: "现货", value: "店里拿得到的货", icon: "tag" },
      { label: "订货", value: "没货的可以订", icon: "file" },
      { label: "批发价", value: "量大另外报价", icon: "money" },
    ],
    wholesale: [
      { label: "批发供货", value: "整箱、整板", icon: "company" },
      { label: "账期", value: "熟客可谈月结", icon: "money" },
      { label: "送货", value: "巴生谷内自家车队", icon: "place" },
    ],
    education: [
      { label: "补习班", value: "小班 / 一对一", icon: "person" },
      { label: "课程", value: "按科目、按年级", icon: "file" },
      { label: "试堂", value: "第一堂可以先试", icon: "date" },
    ],
    services: [
      { label: "上门服务", value: "预约时间上门", icon: "place" },
      { label: "维修 / 保养", value: "报价后才动工", icon: "work" },
      { label: "长期合约", value: "按月、按年", icon: "file" },
    ],
    other: [
      { label: "主要服务", value: "改成你做的第一件事", icon: "work" },
      { label: "第二项", value: "改成第二件", icon: "file" },
      { label: "第三项", value: "改成第三件", icon: "tag" },
    ],
  },
  proof: [
    { value: "10 年", label: "做这一行" },
    { value: "24 小时", label: "内回复" },
    { value: "巴生谷", label: "服务范围" },
  ],
  contact: [
    { label: "WhatsApp", value: "012-345 6789", icon: "phone", placeholder: true },
    { label: "地址", value: "Taman Desa, Kuala Lumpur", icon: "place", placeholder: true },
    { label: "营业时间", value: "星期一至六 9am–6pm", icon: "time", placeholder: true },
  ],
  joinServices: (labels) => labels.join("、"),
  page: {
    askShort: "问价",
    sampleLabel: "示例",
    whatsapp: "WhatsApp 问价",
    callUs: "打给我们",
    whatsappShort: "WhatsApp",
    whatsappFirstLine: "你好，我看到你们的网站，想问一下",
    seeWork: "看我们做过什么",
    contactHeading: "怎么找我们",
    replyNote: "通常一天内回。",
    arrowBadge: "自动",
    arrowBefore: "填完送出 → 你的系统会开一张",
    arrowAfter: "，不用有人转抄。",
    fields: [
      { label: "怎么称呼", placeholder: "陈先生", kind: "text" },
      { label: "电话 / WhatsApp", placeholder: "012-345 6789", kind: "phone" },
      { label: "想做什么", placeholder: "三房翻新，想问大概多少", kind: "long" },
    ],
    byTemplate: {
      quote: {
        services: "我们做什么",
        flow: "找我们之后会怎么走",
        formHeading: "留个电话，我们回你",
        formBlurb: "填三格就好。我们看到会直接 WhatsApp 你，不会打推销电话。",
        submit: "送出",
      },
      booking: {
        services: "可以做什么",
        flow: "怎么预约",
        formHeading: "想约什么时候？",
        formBlurb: "留个电话跟想约的时间，我们确认了回你。",
        submit: "预约",
      },
      order: {
        services: "有什么",
        formHeading: "要订什么？",
        formBlurb: "写下来，我们看到就准备。",
        submit: "落单",
      },
      wholesale: {
        services: "供什么货",
        flow: "怎么合作",
        formHeading: "要报价？",
        formBlurb: "讲一下要什么、大概多少量，我们报价给你。",
        submit: "要报价",
      },
      portfolio: {
        services: "做过什么",
        flow: "合作流程",
        formHeading: "有想做的？",
        formBlurb: "讲一下想做什么，我们回你。",
        submit: "送出",
      },
      card: {
        services: "我们做什么",
        formHeading: "联络我们",
        formBlurb: "",
        submit: "送出",
      },
    },
    sections: {
      work: {
        heading: "做过的工",
        hint: "换成你自己的照片 —— 挑三张最好的。",
        shots: ["放一张照片", "放一张照片", "放一张照片"],
      },
      areas: {
        heading: "服务范围",
        note: "不在这几区？也可以问 —— 值得做的工我们会跑。",
        list: ["吉隆坡", "八打灵再也", "梳邦 / USJ", "莎阿南", "蒲种", "蕉赖", "巴生", "安邦"],
      },
      cta: {
        heading: "讲一下你要做什么，我们上门看",
        note: "上门看不收钱，看完也不一定要做。",
      },
      prices: {
        heading: "大概多少钱",
        note: "这是参考，不是报价。真正的数目要看过才算得准。",
        askLabel: "问一下",
        blank: "RM —",
      },
      reviews: {
        heading: "客人怎么说",
        note: "换成你自己的 —— 截一张 Google 评论贴上来也可以。",
        quotes: [
          { text: "讲几时来就几时来，价钱也没有变过。", who: "一位客人" },
          { text: "哪些要现在做、哪些可以等，讲得清楚，省了我们钱。", who: "一位客人" },
        ],
      },
      faq: {
        heading: "客人常问的",
        rows: [
          { title: "多久会回？", body: "一天内，通常当天下午就回。" },
          { title: "上门看要收钱吗？", body: "不用。先看，再报价。" },
          { title: "怎么给钱？", body: "先付订金开工，做好了、你满意了才收尾款。" },
          { title: "可以 WhatsApp 报价吗？", body: "大概的范围可以，准确的数目要看过。" },
        ],
      },
      hours: {
        heading: "营业时间",
        rows: [
          { label: "星期一至五", value: "早上 9 点 – 傍晚 6 点" },
          { label: "星期六", value: "早上 9 点 – 下午 1 点" },
          { label: "星期日、公共假期", value: "休息" },
          { label: "WhatsApp", value: "随时留言，上班时间回你" },
        ],
      },
      promiseList: {
        heading: "我们答应你的",
        marks: [
          "动工前一定先给你一张写清楚的报价",
          "从头到尾同一个人跟你",
          "上门看不收钱",
          "会加钱的事，加之前先跟你讲",
        ],
      },
    },
  },
};

export const LANDING: Record<SystemLang, LandingCopy> = { en: EN, zh: ZH };

export const landingCopy = (lang: SystemLang): LandingCopy => LANDING[lang];
