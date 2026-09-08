/**
 * 开出十八页、每一种零件种一笔带记号的真资料 —— **一个地方做，两支一起用**。
 *
 * ── 为什么抽出来 ──────────────────────────────────────────────────────────
 *
 * `audit-demo.mjs`（判每一页是真的还是画的）跟 `shoot-pages.mjs`（拍给老板看）
 * 要的前置**一模一样**：一个用完就删的帐号、十八页、每一种零件一笔真资料。
 *
 * 抄第二份的代价这个仓库付过至少八次：489 个区块名、九份小标题、三份风格名单、
 * 九个 uuid（任务 185，九支尺子死了一天而没有人知道）。
 * **一支写入函式加一个参数，第二份就开始漂，而漂的那一天没有人会红。**
 *
 * ⚠️ 这一支**不判对错**。它只负责把台面摆好；谁来量、量什么，是呼叫它的人的事。
 */
import { readFileSync } from "node:fs";

/** 目录里那十八个。**从产品自己的档案读出来**，不是手抄一份。 */
export function moduleKeys() {
  const src = readFileSync("lib/portal/module-catalog.ts", "utf8");
  return [...new Set((src.match(/key: "[a-z_]+"/g) ?? []).map((m) => m.slice(6, -1)))];
}

/** 每一页在英文系统里叫什么。**从目录读出来**，不是手抄。 */
export function moduleLabels() {
  const src = readFileSync("lib/portal/module-catalog.ts", "utf8");
  return Object.fromEntries(
    [...src.matchAll(/key: "([a-z_]+)",\s*\n\s*label: "[^"]*",\s*\n\s*labelEn: "([^"]*)"/g)].map(
      (m) => [m[1], m[2]],
    ),
  );
}

/**
 * 十八页全部开出来。
 *
 * ⚠️ **不传 key 当标题** —— 让它用模块自己的名字，那才是一个真的客户拿到的。
 * 第一版传了 key，於是侧栏上出现「purchases」这种小写的字，而那是**我造的**，
 * 不是产品的毛病。**一个道具的错，会被读成产品的错。**
 */
export async function openAllPages(api, { quiet = false } = {}) {
  const keys = moduleKeys();
  const labels = moduleLabels();
  const opened = [];
  for (const key of keys) {
    if (key === "dashboard" || key === "website") {
      opened.push(key);
      continue;
    }
    const { error } = await api.rpc("add_project_page", {
      requested_key: key,
      new_title: labels[key] ?? key,
    });
    if (error) {
      if (!quiet) console.log(`  ⚠️  开不了 ${key} — ${error.message.slice(0, 70)}`);
    } else opened.push(key);
  }
  return { keys, labels, opened };
}

/**
 * 每一种零件种一笔带记号的真资料。
 *
 * 回传种成功的那几页 —— 判「他自己的资料在不在上面」只能问这几页，
 * 而报表 · 排行 · 总览一行都不存（`shape-state.ts` 把它们标成 `reads`），
 * 记号永远不会出现在那上面。
 */
/**
 * 一门真的生意长什么样 —— **只在拍照的时候用**。
 *
 * ⚠️ 全部是**公司名跟货品名**，一个人名都没有。这个仓库的规矩是
 * 「示范资料不准编人名跟数字冒充他的」；这里是一个用完就删的帐号，
 * 但道具照样照那条走 —— 一张图上出现一个编出来的人名，他会拿去讲话。
 */
const SHOWROOM = {
  /* 🔴 十二个，不是五个（2026-09-05）。
     `align:pages` 拿这一份跟参考那十五张比，而参考那几页**一屏满满的**
     （他们的名册十一行）。我们种五行，於是十页里五页报「底下 26–41% 是空的」
     —— 而那量到的是**行数**，不是排版。两边行数不一样，那一项永远红，
     而一个永远不会变绿的读数没有人会读。
     ⚠️ 拍照那一支照旧只种五行：那一张是**给人看的**，五行读得完。 */
  parties: [
    "Hup Seng Trading", "KL Metalworks", "Seri Jaya Hardware", "Lim Brothers Renovation",
    "Pantai Interiors", "Kepong Timber Yard", "Sentul Glass Works", "Bandar Utama Cabinets",
    "Wangsa Tiles Depot", "Damansara Steel Supply", "Klang Valley Roofing", "Subang Marble House",
  ],
  suppliers: [
    "Chin Hin Cement", "Ann Joo Steel", "Nippon Paint Depot", "Sunway Tiles",
    "Hume Concrete", "Southern Wire", "Kedah Timber Mill", "Selangor Glass Trading",
  ],
  crew: ["Site crew A", "Site crew B", "Wiring team", "Tiling team", "Painting team", "Plumbing team"],
  /* 一个真的客户会填电话跟地区 —— 只给名字的话，「联络方式」跟「状态」
     两整栏是空的，而那两栏正好是那一页三栏里的两栏。
     ⚠️ 号码全部是 `xxxx` 结尾的假号码：一个看起来像真的号码，
     他会拿去打。 */
  phones: [
    "013-2xx xxxx", "012-3xx xxxx", "016-8xx xxxx", "019-4xx xxxx", "011-2xx xxxx",
    "017-6xx xxxx", "014-9xx xxxx", "018-3xx xxxx", "010-7xx xxxx", "015-4xx xxxx",
    "013-8xx xxxx", "012-5xx xxxx",
  ],
  regions: [
    "Taman Desa", "Bukit Jalil", "Cheras", "Sri Petaling", "Ampang", "Kepong",
    "Sentul", "Bandar Utama", "Wangsa Maju", "Damansara", "Klang", "Subang Jaya",
  ],
  states: [
    "In progress", "To follow up", "New", "In progress", "To follow up", "New",
    "In progress", "New", "To follow up", "In progress", "New", "To follow up",
  ],
  jobs: [
    "Taman Desa 3-room repaint", "Bangsar kitchen fitout", "Puchong shoplot rewire",
    "Cheras bathroom retile", "Setapak office partition", "Kepong terrace roofing",
    "Sentul cafe shopfront", "Bandar Utama wardrobe set", "Wangsa Maju floor screed",
    "Damansara balcony grille", "Klang warehouse lighting", "Subang staircase railing",
  ],
  items: [
    ["Cement 50kg", "bags", 1850, 128],
    ["River sand", "loads", 32000, 9],
    ["Ceiling board 4x8", "sheets", 2650, 340],
    ["Emulsion paint 18L", "pails", 18900, 24],
    ["Wall tile 300x600", "boxes", 4200, 6],
    ["PVC conduit 20mm", "lengths", 780, 410],
    ["Plywood 12mm", "sheets", 5600, 72],
    ["Skim coat 20kg", "bags", 2350, 96],
    ["Copper cable 2.5mm", "rolls", 24500, 18],
    ["Door frame set", "sets", 16800, 11],
    ["Floor tile 600x600", "boxes", 5800, 43],
    ["Silicone sealant", "tubes", 950, 220],
  ],
  amounts: [
    48500_00, 12750_00, 96240_00, 7300_00, 21980_00, 15400_00,
    33800_00, 8950_00, 27600_00, 61200_00, 4380_00, 19750_00,
  ],
  /* 🔴 钱那三页要**三串不同的数**。
     2026-09-08 拍出来：收款 · 开销 · 佣金三页并排，三页都写着
     `RM 30,850` —— 因为三页种的是同一串 `paid`，五笔加起来当然一样。
     一间收进来多少就花掉多少、而且整笔都当抽成付掉的生意，读起来是坏的，
     而**产品一个字都没错**（[重点 22d](../../docs/founder-points.md)）。
     三串的量级也照它们真实的样子：进来的最大 · 花掉的次之 ·
     抽成是一小截。 */
  paid: [
    3000_00, 12750_00, 8400_00, 1200_00, 5500_00, 2400_00,
    9800_00, 8950_00, 6300_00, 15000_00, 4380_00, 3900_00,
  ],
  spent: [
    1850_00, 4200_00, 960_00, 7350_00, 2480_00, 1120_00,
    5600_00, 3300_00, 890_00, 6100_00, 2050_00, 1470_00,
  ],
  earned: [
    420_00, 1180_00, 655_00, 300_00, 940_00, 512_00,
    1360_00, 780_00, 245_00, 1050_00, 388_00, 620_00,
  ],
  /* 🔴 阶段要**明写**。它平常是从他问卷那份分析来的
     （`add_pipeline_record` → `analysis_results.after_workflow`），
     而一个用管理钥匙直接开的帐号没有问卷 —— 於是每一行的「状态」是空的，
     五行全白。**那是道具没摆好，不是产品坏了**，但拍出来一模一样。
     顺带：有两种以上的状态，那一排会筛的分段才画得出来。 */
  /* 🔴 阶段要**明写，而且要用这个专案自己那份流程的字**。
     它平常是从他问卷那份分析来的（`add_pipeline_record` →
     `analysis_results.after_workflow`），而一个用管理钥匙直接开的帐号
     没有问卷 —— 於是每一行的「状态」是空的，五行全白。

     第一版我自己编了「Site prep / Finishing」那种字，结果看板画出**八格，
     四格是空的** —— 那是任务 95c 设计好的行为（格子 ＝ 他的流程 ＋
     单据真正在的阶段，一单都不丢），**而我的道具让它看起来像坏的**。
     用它自己那份（chrome.ts 的 STAGE_EN：Enquiry · Quote · Build · Paid）。 */
  stages: {
    quotations: ["Quote", "Approved", "Quote", "Approved", "Enquiry", "Quote",
                 "Approved", "Enquiry", "Quote", "Approved", "Enquiry", "Quote"],
    orders: ["Order", "Deposit", "Build", "Order", "Deposit", "Build",
             "Order", "Deposit", "Build", "Order", "Deposit", "Build"],
    projects: ["Build", "Progress", "Build", "Balance", "Enquiry", "Quote",
               "Approved", "Deposit", "Build", "Progress", "Balance", "Build"],
    tasks: ["Enquiry", "Build", "Progress", "Build", "Enquiry", "Quote",
            "Approved", "Deposit", "Progress", "Build", "Enquiry", "Build"],
    purchases: ["Ordered", "Received", "Paid", "Ordered", "Received", "Paid",
                "Ordered", "Received", "Paid", "Ordered", "Received", "Paid"],
  },
};

export async function seedEveryShape(
  api,
  projectId,
  mark,
  opened,
  /**
   * @param rows 每一种零件种几行。**1 是给尺子用的**（判「他自己的资料在不在
   *   上面」只要一行带记号的就够）；拍照要 5 —— 一页一笔记录判不了设计。
   * @param showroom `true` 时用真的生意名字，不加记号。⚠️ 尺子不可以开它：
   *   记号正是它分辨「他的」跟「示范的」唯一的方法。
   */
  { quiet = false, rows = 1, showroom = false } = {},
) {
  const P = projectId;
  const seeded = new Set();
  /* 🔴 **失败要留下来，`quiet` 只是不要边跑边印。**
     第一版 `quiet` 等於把错误丢掉，於是一句参数写错的 `move_stock`
     静静失败了六次，而拍出来的图看起来像那个设计坏了。
     **一个吞掉错误的种子，跟一个没种进去的种子，在图上长得一模一样。** */
  const failed = [];
  const seed = async (key, fn) => {
    if (!opened.includes(key)) return;
    try {
      const { error } = await fn();
      if (error) {
        failed.push(`${key} — ${error.message.slice(0, 90)}`);
        if (!quiet) console.log(`  ⚠️  种不进 ${key} — ${error.message.slice(0, 80)}`);
      } else seeded.add(key);
    } catch (e) {
      failed.push(`${key} — ${String(e).slice(0, 90)}`);
      if (!quiet) console.log(`  ⚠️  种不进 ${key} — ${String(e).slice(0, 80)}`);
    }
  };

  /* 名字：尺子那一边永远带记号（那是它分辨「他的」唯一的方法），
     拍照那一边用真的生意名字。 */
  const N = Math.max(1, rows);
  const party = (i) => (showroom ? SHOWROOM.parties[i % SHOWROOM.parties.length] : `${mark} Customer`);
  const supplier = (i) => (showroom ? SHOWROOM.suppliers[i % SHOWROOM.suppliers.length] : `${mark} Supplier`);
  const crewName = (i) => (showroom ? SHOWROOM.crew[i % SHOWROOM.crew.length] : `${mark} Crew`);
  const job = (i, key) => (showroom ? SHOWROOM.jobs[i % SHOWROOM.jobs.length] : `${mark} ${key}`);
  const amount = (i) => (showroom ? SHOWROOM.amounts[i % SHOWROOM.amounts.length] : 4_850_00);
  /* 一页一串 —— 见 SHOWROOM.paid 上面那一段。 */
  const SERIES = { payments: "paid", expenses: "spent", commission: "earned" };
  const paid = (i, key) => {
    if (!showroom) return 1_234_00;
    const list = SHOWROOM[SERIES[key] ?? "paid"];
    return list[i % list.length];
  };

  /* ── 名册 ─────────────────────────────────────────────────────────────
     🔴 客户要**先**建，后面每一张单靠它连上人（`in_party_id`）——
     一张只写着名字的单答不了「我们以前报过他多少」。 */
  const custIds = [];
  for (let i = 0; i < N; i++) {
    const { data } = await api.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: party(i),
      ...(showroom
        ? {
            in_phone: SHOWROOM.phones[i % SHOWROOM.phones.length],
            in_region: SHOWROOM.regions[i % SHOWROOM.regions.length],
            in_status: SHOWROOM.states[i % SHOWROOM.states.length],
          }
        : {}),
    });
    if (data?.id) { custIds.push(data.id); seeded.add("customers"); }
  }
  for (let i = 0; i < N; i++) {
    await seed("suppliers", () => api.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "suppliers", in_name: supplier(i),
      ...(showroom
        ? {
            in_phone: SHOWROOM.phones[(i + 2) % SHOWROOM.phones.length],
            in_region: SHOWROOM.regions[(i + 1) % SHOWROOM.regions.length],
          }
        : {}),
    }));
  }
  const crewIds = [];
  for (let i = 0; i < Math.min(N, 3); i++) {
    const { data } = await api.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "staff", in_name: crewName(i),
      ...(showroom ? { in_phone: SHOWROOM.phones[(i + 1) % SHOWROOM.phones.length] } : {}),
    });
    if (data?.id) { crewIds.push(data.id); seeded.add("staff"); }
  }

  /* ── 走单 ─────────────────────────────────────────────────────────── */
  const orderIds = [];
  for (const key of ["quotations", "orders", "projects", "tasks", "purchases"]) {
    for (let i = 0; i < N; i++) {
      await seed(key, async () => {
        const res = await api.rpc("add_pipeline_record", {
        in_project_id: P, in_module_key: key,
        in_title: job(i, key),
        in_party: key === "purchases" ? supplier(i) : party(i),
        in_party_id: key === "purchases" ? null : custIds[i % Math.max(custIds.length, 1)] ?? null,
        in_amount_cents: amount(i),
          ...(showroom ? { in_stage: SHOWROOM.stages[key][i % SHOWROOM.stages[key].length] } : {}),
        });
        if (key === "orders" && res.data?.id) orderIds.push(res.data.id);
        return res;
      });
    }
  }

  /* ── 记帐 ─────────────────────────────────────────────────────────── */
  for (const key of ["payments", "expenses", "commission"]) {
    for (let i = 0; i < N; i++) {
      /* 🔴 一部分收款**要分摊到单上**。不分摊，「这个月收到」跟
         「还没用完的订金」会是同一个数字 —— 那两张卡并排印同一个数，
         读起来像坏的，而它其实只是「这门生意从来没有对过帐」。 */
      const against = showroom && key === "payments" && i % 2 === 0
        ? orderIds[i % Math.max(orderIds.length, 1)] ?? null
        : null;
      await seed(key, () => api.rpc("add_ledger_entry", {
        in_project_id: P, in_module_key: key,
        ...(against ? { in_against_id: against } : {}),
        in_amount_cents: paid(i, key),
        /* 🔴 抽成是付给**师傅**的，不是付给客户的。
           2026-09-08 拍出来：佣金那一页每一行的「Paid to」写着
           `Pantai Interiors` —— 一家客户公司。而右边那条比例条
           （「谁抽得最多」）读的是同一栏，所以整页在讲
           **他把抽成付给了他的客人**。产品一个字都没错
           （[重点 22d](../../docs/founder-points.md)）。 */
        in_party:
          key === "expenses" ? supplier(i) : key === "commission" ? crewName(i) : party(i),
        in_note: showroom
          ? (key === "expenses" ? `Materials — ${supplier(i)}` : `${job(i, key)} — ${key === "commission" ? "crew share" : "deposit"}`)
          : `${mark} note`,
      }));
    }
  }

  /* ── 货架 ─────────────────────────────────────────────────────────────
     🔴 **建一件货不等於架上有货。** 第一版只呼叫 `add_catalog_item`，
     於是拍出来每一件都写着「0 · Out of stock」—— 一张写着零的货架，
     判不了「一件东西一张卡」那个设计对不对。 */
  const itemIds = [];
  for (let i = 0; i < (showroom ? SHOWROOM.items.length : 1); i++) {
    const [name, unit, price] = showroom ? SHOWROOM.items[i] : [`${mark} Cement`, "bags", 1850];
    const { data } = await api.rpc("add_catalog_item", {
      in_project_id: P, in_module_key: "inventory",
      in_name: name, in_unit: unit, in_price_cents: price,
    });
    if (data?.id) { itemIds.push([data.id, showroom ? SHOWROOM.items[i][3] : 0]); seeded.add("inventory"); }
  }
  for (const [id, qty] of itemIds) {
    if (!qty) continue;
    /* ⚠️ `move_stock` **没有 `in_project_id`**（它从货品那一行推出来）。
       第一版传了，於是每一次都报错、而 `quiet` 把它吞掉 ——
       拍出来六格货架全部写「0 · Out of stock」，看起来像那个设计坏了。 */
    await seed("inventory", () => api.rpc("move_stock", {
      in_item_id: id, in_qty: qty,
      in_direction: "in", in_reason: "Opening balance",
    }));
  }

  /* 对帐要种，才分得出「正确地在示范」跟「根本读不到他的」——
     那两件在画面上长得一模一样，而只有种一笔才问得出来。 */
  /* 🔴 拍照要**几家上游**，不是一家 —— 对帐那一页 9-05 起是「一组一张表」，
     而只有一组的时候它正确地不分组。一家上游拍出来看不到那个设计。
     尺子那一边照旧一笔（记号那一笔就够）。 */
  const banks = showroom
    ? ["Maybank current account", "CIMB business", "Public Bank"]
    : [`${mark} Bank`];
  for (let i = 0; i < banks.length; i++) {
    await seed("reconciliation", () => api.rpc("add_reconciliation", {
      in_project_id: P, in_module_key: "reconciliation",
      /* 每一家自己一个月份，不然同一个期间同一家会撞。 */
      in_period: new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
        .toISOString()
        .slice(0, 8) + "01",
      in_source: banks[i],
      in_their_cents: paid(i),
    }));
  }
  /* 🔴 上班时间，不是「现在开始每小时一个」（2026-09-05）。
   *
   * 原本是 `Date.now() + (i+1) 小时`，而这一支常常在晚上跑 ——
   * 於是那一页画出 **21:32 · 22:32 · 23:32 · 00:33 · 01:33 · 03:33**：
   * **一间沙龙半夜三点在做交屋走查。**
   * 那是道具没摆好，不是产品坏了，**而拍出来一模一样** ——
   * 而这一页正是老板会拿去给沙龙老板看的那一页。
   *
   * 一天排九点到下午五点，一小时一个，排满就换下一天。
   * ⚠️ 从**今天**排起，不是从明天 —— 那一页的标题就是「今天」，
   * 而一个今天空着的行事历，跟一个坏掉的行事历长得一模一样。 */
  const OPEN_HOUR = 9;
  const SLOTS_A_DAY = 8; // 09:00 – 17:00
  for (let i = 0; i < N; i++) {
    const day = Math.floor(i / SLOTS_A_DAY);
    const at = new Date();
    at.setHours(OPEN_HOUR + (i % SLOTS_A_DAY), 0, 0, 0);
    at.setDate(at.getDate() + day);
    await seed("bookings", () => api.rpc("add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: at.toISOString(),
      in_ends_at: new Date(at.getTime() + 3600e3).toISOString(),
      in_party: party(i),
      in_service: showroom ? ["Site measurement", "Handover walkthrough", "Defect check", "Colour selection", "Final inspection"][i % 5] : `${mark} service`,
    }));
  }

  seeded.failed = failed;
  return seeded;
}
