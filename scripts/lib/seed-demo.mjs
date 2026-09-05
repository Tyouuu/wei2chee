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
  parties: ["Hup Seng Trading", "KL Metalworks", "Seri Jaya Hardware", "Lim Brothers Renovation", "Pantai Interiors"],
  suppliers: ["Chin Hin Cement", "Ann Joo Steel", "Nippon Paint Depot", "Sunway Tiles"],
  crew: ["Site crew A", "Site crew B", "Wiring team"],
  jobs: [
    "Taman Desa 3-room repaint", "Bangsar kitchen fitout", "Puchong shoplot rewire",
    "Cheras bathroom retile", "Setapak office partition",
  ],
  items: [
    ["Cement 50kg", "bags", 1850, 128],
    ["River sand", "loads", 32000, 9],
    ["Ceiling board 4x8", "sheets", 2650, 340],
    ["Emulsion paint 18L", "pails", 18900, 24],
    ["Wall tile 300x600", "boxes", 4200, 6],
    ["PVC conduit 20mm", "lengths", 780, 410],
  ],
  amounts: [48500_00, 12750_00, 96240_00, 7300_00, 21980_00],
  paid: [3000_00, 12750_00, 8400_00, 1200_00, 5500_00],
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
    quotations: ["Quote", "Approved", "Quote", "Approved", "Enquiry"],
    orders: ["Order", "Deposit", "Build", "Order", "Deposit"],
    projects: ["Build", "Progress", "Build", "Balance", "Enquiry"],
    tasks: ["Enquiry", "Build", "Progress", "Build", "Enquiry"],
    purchases: ["Ordered", "Received", "Paid", "Ordered", "Received"],
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
  const paid = (i) => (showroom ? SHOWROOM.paid[i % SHOWROOM.paid.length] : 1_234_00);

  /* ── 名册 ─────────────────────────────────────────────────────────────
     🔴 客户要**先**建，后面每一张单靠它连上人（`in_party_id`）——
     一张只写着名字的单答不了「我们以前报过他多少」。 */
  const custIds = [];
  for (let i = 0; i < N; i++) {
    const { data } = await api.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: party(i),
    });
    if (data?.id) { custIds.push(data.id); seeded.add("customers"); }
  }
  for (let i = 0; i < N; i++) {
    await seed("suppliers", () => api.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "suppliers", in_name: supplier(i),
    }));
  }
  const crewIds = [];
  for (let i = 0; i < Math.min(N, 3); i++) {
    const { data } = await api.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "staff", in_name: crewName(i),
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
        in_amount_cents: paid(i),
        in_party: key === "expenses" ? supplier(i) : party(i),
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
  for (let i = 0; i < N; i++) {
    await seed("bookings", () => api.rpc("add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: new Date(Date.now() + (i + 1) * 3600e3).toISOString(),
      in_ends_at: new Date(Date.now() + (i + 1) * 3600e3 + 3600e3).toISOString(),
      in_party: party(i),
      in_service: showroom ? ["Site measurement", "Handover walkthrough", "Defect check", "Colour selection", "Final inspection"][i % 5] : `${mark} service`,
    }));
  }

  seeded.failed = failed;
  return seeded;
}
