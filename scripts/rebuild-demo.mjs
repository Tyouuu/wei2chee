/**
 * 把 demo 帐号建回来。
 *
 * ── 为什么要有这一支 ──────────────────────────────────────────────────────
 *
 * 🔴 **2026-09-04，我自己删掉了它。**
 *
 * 那天我去数资料库，发现 46 个帐号里 45 个是测试帐号（每一支脚本跑完都印着
 * 「临时帐号删掉了」，而 `deleteUser` 一直在回 `Database error deleting user`，
 * 被 `.catch(() => {})` 吞掉）。修好那件事之后，我拿
 * `/@formae\.test$/` 一次删了 45 个 ——
 * **而 `tianyou.demo@formae.test` 就在那一串里面。**
 *
 * 那是老板拿来给人看的那一个：`/s/xingfa-reno` 当场变成 404。
 *
 * 我犯的错很具体，写下来：**一条正则跟一个 for 回圈，我没有先把那 45 个
 * 名字读出来看一眼。** 名单里有一个不是垃圾，而它是最重要的那一个。
 *
 * ── 救得回来的跟救不回来的 ────────────────────────────────────────────────
 *
 *   ✅ **官网那一页**    `.screenshots/skeletons/restore.json` 里有整份版面
 *                        （兴发装修工程、他的服务、他的价目），6.2 KB
 *   ✅ **72 张照片**     storage 没有跟着 cascade，而那个桶是公开的 ——
 *                        版面里那些网址今天照样打得开
 *   ✅ **问卷跟分析**    17 笔 lead、12 份分析全在（accounts 指向 leads，
 *                        不是反过来），所以其余五页是**照原本那条路重新长出来的**
 *   ❌ **那五页上的手改** 几个星期累积的编辑，没有第二份
 *   ❌ **那一笔询价**     `site_enquiries` 一行 —— 而那一行是我们自己测的
 *                        （[任务 96](docs/founder-tasks.md#96) 量过：
 *                        有史以来一笔，而那一笔是我们填的）
 *
 * ── 一件要讲清楚的 ────────────────────────────────────────────────────────
 *
 * 存档里那一套风格叫 `tile`（瓷），而 8-26 那次大洗牌把十七套砍到六套，
 * 瓷不在里面了。所以这里给它 **`ledger`（台账）** ——
 * [任务 35](docs/founder-tasks.md#35) 那张表里，装修那一行的第一张就是它。
 * **那是一个新的决定，不是复原**，所以写在这里而不是默默设进去。
 *
 *   node scripts/rebuild-demo.mjs            # 只讲要做什么
 *   node scripts/rebuild-demo.mjs --write    # 真的做
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const WRITE = process.argv.includes("--write");
/* 🔴 存档那份版面是 8-27 存的，那时候那套风格叫 `tile`。放回一个
   已经不存在的风格的版面，画出来是坏的（名字印两次、底下一大片空）。
   所以预设**用 signup 自己生成的那一份** —— 内容一样来自那份分析，
   而它是照今天的风格生成的。`--from-backup` 才用存档那一份。 */
const FROM_BACKUP = process.argv.includes("--from-backup");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";
const SLUG = "xingfa-reno";
/* 🔴 装修那一行的第一张是**台账**（任务 35），而这里用**图纸**。
   两个理由，两个都是量出来的，不是喜好：

   ① 公开第一屏那句大标题读不读得到（h1 对底）
        ledger 1.32 🔴 · signboard 1.18 🔴
        hearth 13.62 · blueprint 15.54 · swiss 16.97 · counter 17.02
      台账那一屏是**看不见的**，而[重点 11](docs/founder-points.md) 说那一屏就是产品。

   ② 官网上有没有**询价表格**（`dropBlocks` 里有没有 website-form）
        ledger 有 · blueprint 有 · swiss 有
        hearth 没有 · counter 没有 · signboard 没有

   ⚠️ 我第一版选了 hearth（只看了①），结果那个 demo 站**没有询价表格** ——
   而「客人从官网询价、一按变成报价单」正是这个产品唯一讲得出口的那一件
   （[任务 89](docs/founder-tasks.md#89)）。一个示范不出那件事的示范站，
   等於把最值钱的那一段藏起来。
   両条都过的只有 **blueprint** 跟 **swiss**，取图纸（它的主张是「中规中矩、
   要人信任」，对一个装修承包商比较对）。

   ⚠️ 台账跟招牌那两套要修，但那是风格层（[重点 22c](docs/founder-points.md)），
   不是这里 —— 已经登记。 */
const REGISTER = "blueprint";
/* 「你的报价发出去之后没人跟，钱卡在确认这一步。」—— 就是这一个 demo
   当初的那份分析（[任务 18] 里那句「Watch this: 报价追不动」）。 */
const LEAD_SUMMARY = "你的报价发出去之后没人跟";
const BACKUP = ".screenshots/skeletons/restore.json";

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const say = (s) => console.log(s);

if (!existsSync(BACKUP)) {
  console.error(`没有 ${BACKUP} —— 官网那一页救不回来，先不要跑这一支。`);
  process.exit(1);
}
const saved = JSON.parse(readFileSync(BACKUP, "utf8"));

/* ⚠️ 不覆盖。已经有一个同名的帐号，就表示有人已经建回来了，
   而再建一次会把那一个删掉 —— 这一支存在的原因就是我干过一次那种事。 */
const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const already = users.users.find((u) => u.email === EMAIL);
if (already) {
  say(`${EMAIL} 已经在了（${already.created_at.slice(0, 10)}）—— 什么都不做。`);
  process.exit(0);
}

const { data: leads } = await db.from("leads").select("id, industry_id");
const { data: analyses } = await db.from("analysis_results").select("lead_id, summary");
const match = (analyses ?? []).find((a) => (a.summary ?? "").includes(LEAD_SUMMARY));
if (!match) {
  console.error("找不到那份分析 —— 不要拿另一份顶上，那会长出另一家公司。");
  process.exit(1);
}
const lead = (leads ?? []).find((l) => l.id === match.lead_id);

say(`要建：${EMAIL}`);
say(`  问卷    ${lead.id}`);
say(`  分析    ${match.summary.slice(0, 40)}…`);
say(`  风格    ${REGISTER}（台账第一屏 1.32:1 读不到；満図 官网没有询价表格）`);
say(`  网址    /s/${SLUG}`);
say(`  官网    从 ${BACKUP} 放回去（${JSON.stringify(saved.layout_json).length} bytes）`);
if (!WRITE) {
  say("\n(只讲不做。要真的做，加 --write)");
  process.exit(0);
}

const { data: made, error: mkErr } = await db.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { lead_id: lead.id },
});
if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
say(`\n建好了 ${made.user.id}`);

const { data: proj, error: prErr } = await db
  .from("projects")
  .select("id")
  .eq("account_id", made.user.id)
  .single();
if (prErr || !proj) throw new Error(`那个 signup 触发器没有开出 project: ${prErr?.message}`);

const { error: upErr } = await db
  .from("projects")
  .update({
    style: REGISTER,
    site_slug: SLUG,
    site_published: true,
    /* 存过页面要付款闸放行，而这是我们自己的示范帐号。 */
    paid: true,
    stage: "live",
    system_language: "en",
  })
  .eq("id", proj.id);
if (upErr) throw new Error(`设定 project: ${upErr.message}`);

const { data: pages } = await db
  .from("project_pages")
  .select("id, page_key")
  .eq("project_id", proj.id);
say(`长出 ${pages.length} 页：${pages.map((p) => p.page_key).join(", ")}`);

const site = pages.find((p) => p.page_key === "website");
if (!site) throw new Error("没有官网那一页 —— 那份分析没有推荐 website？");

if (FROM_BACKUP) {
  const { error: layoutErr } = await db
    .from("project_pages")
    .update({ layout_json: saved.layout_json })
    .eq("id", site.id);
  if (layoutErr) throw new Error(`放回官网版面: ${layoutErr.message}`);
  say("官网那一页用存档那一份放回去了 ——");
  say("  ⚠️ 那一份是 8-27 存的，那时候的风格叫 `tile`，而它已经砍掉了。");
  say("     实拍过：名字会印两次，底下一大片空。除非你知道自己在做什么，不要用。");
} else {
  say("官网那一页是 signup 自己生成的（内容同一份分析，版面照今天的风格）");
}

say(`\n好了。${EMAIL} / ${PASSWORD}`);
say(`  /s/${SLUG} 要等一次部署才会活（Vercel 大约 105 秒）`);
say("  ⚠️ 其余五页是重新长出来的，不是那几个星期的手改 —— 那一份没有第二份");
