/**
 * 一门生意的道具 —— 沙龙 · medi spa · 补习中心。
 *
 * ── 为什么要这一份（[重点 22d](../../docs/founder-points.md)）─────────────
 *
 * `seed-demo.mjs` 里那一份 `SHOWROOM` 是**一家装修公司**：货架上是水泥跟沙、
 * 预约写着「Taman Desa 三房翻新」、师傅叫「Site crew A」。
 * 拿它去拍一间沙龙，画面上会是一间**卖水泥的发廊** ——
 * **产品一个字都没错，而他看到的是坏的**，而他 2026-09-06 就为这件事
 * 问过一次「這個對嗎 怎麼看起來怪怪的」（那一次是一家有 Panadol、
 * 又出租婚宴椅子的店）。
 *
 * ⚠️ **只覆盖真的不一样的那几栏**（`...SHOWROOM` 打底）——
 * 电话 · 金额那几串照旧共用，抄第二份的代价这个仓库付过至少八次。
 *
 * ⚠️ **地名换成怡保**：他人在怡保，而 `find:prospects` 的名单也是
 * （[任务 154](../../docs/founder-tasks.md)）。一张写满巴生谷地名的图，
 * 对他要上门的那 1,225 家是错的。
 *
 * ⚠️ **`stages` 不覆盖** —— 那几个字要跟产品自己那一份对得上
 * （`chrome.ts` 的 STAGE_EN），编一个「Site prep」出来，看板会画出
 * 八格、四格是空的，而那是道具的错不是产品的错。
 */
import { SHOWROOM } from "./seed-demo.mjs";

/* 怡保。全部是真的区，而它们只是**地名**，不是任何一个人的地址。 */
const IPOH = [
  "Bercham", "Ipoh Garden", "Menglembu", "Gunung Rapat", "Tambun", "Falim",
  "Canning Garden", "Pasir Pinji", "Simee", "Taman Meru", "Kampar Road", "Silibin",
];

/* 客人的名字：**只有姓，加一个称谓**。
   一间沙龙的名册上不可能是「Hup Seng Trading」，而一个完整的编出来的人名
   他会拿去讲话（这个仓库的规矩）。姓氏加称谓读得出是一本真的簿子，
   而它指不到任何一个人。 */
const GUESTS = [
  "Ms Tan", "Ms Lim", "Mrs Chan", "Ms Wong", "Ms Rahim", "Mrs Lee",
  "Ms Kaur", "Ms Ng", "Mrs Ooi", "Ms Foo", "Mrs Yeoh", "Ms Devi",
];

export const TRADES = {
  /* 沙龙 —— `beauty`，开箱八页（[任务 306](../../docs/founder-tasks.md)）。
     她一天问四句：今天谁上班 · 现在几张椅子有人 · 这个月 Amy 抽多少 ·
     洗发水还剩几瓶。 */
  salon: {
    industry: "beauty",
    business: "Wei Hair Studio",
    /* 他自己的词 —— 客人不叫「客户」，师傅不叫「员工」。 */
    words: { customers: "Guests", bookings: "Appointments", staff: "Stylists", inventory: "Salon stock" },
    props: {
      ...SHOWROOM,
      parties: GUESTS,
      regions: IPOH,
      suppliers: [
        "Kao Salon Supply", "Beauty Depot Ipoh", "Wella Trading", "Nail Care Supply",
        "Salon Furniture Co", "Perak Hair Products",
      ],
      crew: ["Amy", "Jasmine", "Fara", "Wei Ling", "Sarah", "Mei"],
      jobs: [
        "Cut and blow", "Colour touch-up", "Rebonding", "Perm and treatment",
        "Hair spa", "Highlights", "Keratin treatment", "Wash and set",
        "Root touch-up", "Balayage", "Scalp treatment", "Trim and style",
      ],
      /* 行事历上那几个字。一间沙龙的预约就是一个服务名 —— 跟单据那几行同一批。 */
      services: [
        "Cut and blow", "Colour touch-up", "Rebonding", "Hair spa", "Highlights",
      ],
      items: [
        ["Shampoo 1L", "bottles", 4800, 14],
        ["Colour tube 60ml", "tubes", 3200, 46],
        ["Developer 1L", "bottles", 2600, 11],
        ["Treatment mask 500ml", "tubs", 8900, 7],
        ["Hair spray 400ml", "cans", 2900, 19],
        ["Bleach powder 500g", "tubs", 5400, 4],
      ],
      amounts: [4500, 8000, 12000, 18000, 6500, 25000, 9500, 38000, 15000, 7000, 22000, 5500],
      paid: [4500, 8000, 12000, 6500, 9500],
      spent: [4800, 8900, 2600, 3200, 5400],
      earned: [1350, 2400, 3600, 1950, 2850],
    },
  },

  /* medi spa —— 也是 `beauty`，**同一份八页**。
     不一样的在客户那一页上：疗程记录 · 前后照片 · 同意书
     （[任务 310](../../docs/founder-tasks.md) · [311](#311) · [313](#313)）。
     而在货架上它是**针剂跟耗材，带批号跟效期**，不是洗发水。 */
  medispa: {
    industry: "beauty",
    business: "Radiance Medi Spa",
    words: { customers: "Clients", bookings: "Treatments", staff: "Therapists", inventory: "Clinic stock" },
    props: {
      ...SHOWROOM,
      parties: GUESTS,
      regions: IPOH,
      suppliers: [
        "Dermal Supply Asia", "Skin Lab Trading", "MediSpa Equipment",
        "Aesthetic Depot KL", "Clinical Consumables", "Laser Parts Asia",
      ],
      crew: ["Wei Ling", "Nurul", "Michelle", "Su Yin", "Priya", "Hana"],
      jobs: [
        "HydraFacial", "Chemical peel", "Laser hair removal", "Microneedling",
        "IPL photofacial", "Skin booster", "Pigment laser", "Acne programme",
        "RF slimming", "Lymphatic massage", "Consultation", "Post-care review",
      ],
      /* 🔴 一间 medi spa 的行事历上是**疗程**，而一个疗程要一间房
         （[任务 308](../../docs/founder-tasks.md)：会撞的是房间跟机器，不是椅子）。 */
      services: [
        "HydraFacial", "Chemical peel", "Laser hair removal", "Microneedling", "Consultation",
      ],
      items: [
        ["Peel solution 30ml", "vials", 18500, 9],
        ["Serum ampoule 5ml", "boxes", 24000, 6],
        ["Numbing cream 30g", "tubes", 6800, 12],
        ["Microneedle cartridge", "pcs", 4200, 38],
        ["Laser tip 12mm", "pcs", 32000, 3],
        ["Sheet mask (clinic)", "boxes", 9800, 15],
      ],
      amounts: [28000, 45000, 88000, 120000, 35000, 260000, 68000, 155000, 42000, 98000, 32000, 75000],
      paid: [28000, 45000, 88000, 35000, 68000],
      spent: [18500, 24000, 6800, 32000, 9800],
      earned: [4200, 6750, 13200, 5250, 10200],
    },
  },

  /* 补习中心 —— `education`，七页，而且它开得了单
     （`orders` 不是 `quotations`：没有人跟家长报价，[任务 306](#306)）。
     一个班十个学生走的是班级那几页（[任务 223](#223) · [241](#241)）。 */
  tuition: {
    industry: "education",
    business: "Bright Minds Tuition",
    words: { customers: "Students", bookings: "Class sessions", orders: "Fee bills" },
    props: {
      ...SHOWROOM,
      /* 学生：**名 + 班级**。一间补习中心的名册上，班级跟名字一样重要 ——
         而那一栏正好是他每天在找的东西。 */
      parties: [
        "Wei Ming · Form 4", "Aisyah · Form 3", "Jia Hui · Form 5", "Arun · Form 2",
        "Xin Yi · Form 4", "Danish · Form 1", "Mei Xuan · Form 5", "Harith · Form 3",
        "Zhi Hao · Form 2", "Nurin · Form 4", "Kai Wen · Form 5", "Shalini · Form 1",
      ],
      regions: IPOH,
      suppliers: [
        "Oxford Fajar", "Pelangi Books", "Ilmu Bakti Supply",
        "Stationery Depot Ipoh", "Printing Shop Bercham", "Exam Paper Press",
      ],
      crew: ["Ms Chong · Maths", "Mr Raj · Physics", "Ms Aisyah · BM", "Mr Lee · Chemistry", "Ms Tan · English", "Mr Chin · Add Maths"],
      jobs: [
        "September fee — Form 4 Maths", "September fee — Form 5 Add Maths",
        "September fee — Form 3 Science", "September fee — Form 2 English",
        "September fee — Form 1 BM", "September fee — Form 5 Physics",
        "September fee — Form 4 Chemistry", "September fee — Form 3 Maths",
        "September fee — Form 2 Science", "September fee — Form 1 English",
        "September fee — Form 5 Chemistry", "September fee — Form 4 Physics",
      ],
      /* 🔴 **状态那几个字跟着这一行自己的流程走。**
         资料库里 education 的 `default_workflow` 是
         `["Customer","Enrollment","Payment"]`，经过 `translateStage` 是
         **Enquiry · Enrolment · Paid**。而我第一版没有覆盖它，於是学费单上
         印的是装修那三个字：**Deposit · Order · Build** ——
         一张补习费单写着「Build」（2026-09-09 拍出来看到的）。
         ⚠️ 上面那一段档头说 `stages` 不要覆盖，讲的是**不要自己编字**；
         这里用的是**产品自己那一份**（`chrome.ts` 的 STAGE_EN 对 education 的
         那三个），所以看板照样画得出格子，一格都不会空。 */
      stages: {
        ...SHOWROOM.stages,
        orders: ["Paid", "Enrolment", "Enquiry", "Paid", "Enrolment",
                 "Enquiry", "Paid", "Enrolment", "Enquiry", "Paid",
                 "Enrolment", "Enquiry"],
      },
      /* 🔴 补习的「预约」不是一个人来一次，是**一堂课**
         （[任务 223](../../docs/founder-tasks.md)：一个老师十个学生）。
         所以这几个字是课，不是服务。 */
      services: [
        "Form 4 Maths", "Form 5 Add Maths", "Form 3 Science", "Form 2 English", "Form 5 Physics",
      ],
      items: [
        ["Form 4 Maths workbook", "copies", 2800, 24],
        ["Form 5 Add Maths module", "copies", 3500, 11],
        ["Past year papers (set)", "sets", 1800, 40],
        ["Whiteboard marker", "boxes", 1500, 6],
        ["A4 paper ream", "reams", 1400, 18],
        ["Form 3 Science notes", "copies", 2200, 9],
      ],
      amounts: [18000, 22000, 25000, 18000, 32000, 20000, 28000, 18000, 24000, 30000, 22000, 26000],
      paid: [18000, 22000, 25000, 20000, 28000],
      spent: [2800, 3500, 1800, 1500, 1400],
      earned: [3600, 4400, 5000, 4000, 5600],
    },
  },
};
