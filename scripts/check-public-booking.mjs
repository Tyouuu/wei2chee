/**
 * 陌生人在官网上订一个时段 —— **用真的陌生人打**（没有登入的那一把钥匙）。
 *
 * ── 为什么一定要用 anon ──────────────────────────────────────────────────
 *
 * 这条线的呼叫者**不是一个客户**，是一个站在别人官网上的路人。
 * 拿老板的登入去测它，测到的是一条根本不存在的路：RLS 不一样、
 * `auth.uid()` 不一样、grant 不一样。
 *
 * ⚠️ 而这一支同时在守一件比功能更重要的事：**陌生人看得到什么**。
 * 一张写着「10:00 陈太太 染发」的公开页面，是把他客人的行踪贴到网上。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
/** 🔴 一个真的路人：anon key，没有登入过。 */
const stranger = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * 3600e3).toISOString();

async function shop(tag, { withBookings = true, publish = true } = {}) {
  const cred = { email: `pub-${tag}-${Date.now()}@formae.test`, password: `Pub-${Date.now()}-x!` };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email, password: cred.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await as.auth.signInWithPassword(cred);
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", user.user.id).single();

  await as.rpc("set_project_style", { new_style: "hearth" });
  if (withBookings) await as.rpc("add_project_page", { requested_key: "bookings", new_title: "Bookings" });

  const slug = `${tag}-${Date.now().toString().slice(-7)}`;
  /* 网址跟上线那两步走 service role —— 发布那条路是画面的事，
     这一支要验的是**上线之后**陌生人碰得到什么。 */
  await admin.from("projects")
    /* ⚠️ 这里是**栏位名**，不是那两支函式的参数名。
       上一版我把整个档案里的 `site_slug:` 一口气换成 `p_slug:`，
       连这一行也换掉了 —— 於是三家店都没有网址，而画面上报的是
       「not_found」，看起来像产品坏了。**错的是我的道具。** */
    .update({ site_slug: slug, site_published: publish })
    .eq("id", proj.id);

  /* 🔴 摆好了就当场问回来。第一版没问，於是三家店的网址全是 null，
     而每一条断言报的是「not_found」—— 一个**道具没摆好**的跑法，
     跟一个**产品坏掉**的跑法，在报告里长得一模一样。 */
  const { data: back } = await admin
    .from("projects").select("site_slug, site_published").eq("id", proj.id).single();
  if (back?.site_slug !== slug || back?.site_published !== publish) {
    throw new Error(`[setup ${tag}] 网址没摆好：slug=${back?.site_slug} published=${back?.site_published}`);
  }
  return { as, projectId: proj.id, slug };
}

try {
  const salon = await shop("salon");
  const draft = await shop("draft", { publish: false });
  const noDiary = await shop("nodiary", { withBookings: false });

  /* ── ① 一个路人订得了 ──────────────────────────────────────────────── */
  console.log("\n① 路人订一个时段");
  const start = at(48);
  const end = at(49);
  const { data: booked, error: bookErr } = await stranger.rpc("submit_site_booking", {
    p_slug: salon.slug,
    visitor_name: "Ms Lim",
    visitor_contact: "012-345 6789",
    wants_from: start,
    wants_to: end,
    wants_service: "Cut and colour",
    visitor_note: "First time",
  });
  check("订得了", !bookErr && /^ok:/.test(String(booked)), bookErr?.message ?? String(booked));

  const { data: seen } = await salon.as
    .from("appointments").select("party, service, source, status, extra, public_ref")
    .eq("project_id", salon.projectId);
  const row = (seen ?? [])[0];
  check("🔴 老板那一页上真的多了一笔", (seen ?? []).length === 1, `${seen?.length} 笔`);
  check("名字带过去了", row?.party === "Ms Lim", row?.party);
  check("知道是官网来的", row?.source === "website", row?.source);
  check("🔴 联络方式看得回来（不是吞掉他打的字）",
    row?.extra?.contact === "012-345 6789", JSON.stringify(row?.extra));
  check("给了他一串可以改的号码", String(booked).slice(3) === row?.public_ref,
    `${booked} vs ${row?.public_ref}`);

  /* ── ② 两个人同时按 ───────────────────────────────────────────────── */
  console.log("\n② 第二个人订同一个时段");
  const { data: clash } = await stranger.rpc("submit_site_booking", {
    p_slug: salon.slug, visitor_name: "Mr Ong", visitor_contact: "011-111 1111",
    wants_from: start, wants_to: end,
  });
  /* 🔴 「刚被订走了」，不是一句资料库的错误 —— 那是订位页上的常态。 */
  check("🔴 回「刚被订走了」，不是一句资料库的话", clash === "taken", String(clash));
  const { count } = await salon.as
    .from("appointments").select("id", { count: "exact", head: true })
    .eq("project_id", salon.projectId);
  check("而且没有多一笔出来", count === 1, `${count} 笔`);

  /* ── ③ 陌生人看得到什么 ───────────────────────────────────────────── */
  console.log("\n③ 陌生人看得到什么");
  const day = new Date(Date.now() + 48 * 3600e3 + 8 * 3600e3).toISOString().slice(0, 10);
  const { data: slots, error: slotErr } = await stranger.rpc("public_booking_slots", {
    p_slug: salon.slug, p_day: day,
  });
  check("看得到那个时段被占着", !slotErr && (slots ?? []).length === 1,
    slotErr?.message ?? JSON.stringify(slots));
  /* 🔴 只有时间。名字 · 服务 · id · 师傅一个都不给。 */
  const keys = Object.keys((slots ?? [])[0] ?? {}).sort();
  check("🔴 只回时间，名字跟服务一个字都没有",
    JSON.stringify(keys) === JSON.stringify(["ends_at", "starts_at"]), JSON.stringify(keys));

  /* 而那张表本身，路人一行都读不到。 */
  const { data: peek } = await stranger
    .from("appointments").select("party").eq("project_id", salon.projectId);
  check("🔴 那张表路人一行都读不到", (peek ?? []).length === 0, `${peek?.length} 行`);

  /* ── ④ 取消之后那个时段空回来 ─────────────────────────────────────── */
  console.log("\n④ 老板取消之后");
  await admin.from("appointments").update({ status: "cancelled" }).eq("id", row?.public_ref ? undefined : undefined);
  await admin.from("appointments").update({ status: "cancelled" })
    .eq("project_id", salon.projectId);
  const { data: afterCancel } = await stranger.rpc("public_booking_slots", {
    p_slug: salon.slug, p_day: day,
  });
  check("取消掉的不再占位", (afterCancel ?? []).length === 0, JSON.stringify(afterCancel));
  const { data: reBook } = await stranger.rpc("submit_site_booking", {
    p_slug: salon.slug, visitor_name: "Mr Ong", visitor_contact: "011-111 1111",
    wants_from: start, wants_to: end,
  });
  check("而且那个时段订得回来", /^ok:/.test(String(reBook)), String(reBook));

  /* ── ⑤ 拒绝的每一种 ───────────────────────────────────────────────── */
  console.log("\n⑤ 每一种拒绝");
  const say = async (over) =>
    (await stranger.rpc("submit_site_booking", {
      p_slug: salon.slug, visitor_name: "X", visitor_contact: "0123",
      wants_from: at(72), wants_to: at(73), ...over,
    })).data;

  check("没写名字 → incomplete", (await say({ visitor_name: "  " })) === "incomplete");
  check("没写联络 → incomplete", (await say({ visitor_contact: "" })) === "incomplete");
  check("名字太长 → too_long", (await say({ visitor_name: "A".repeat(200) })) === "too_long");
  check("过去的时间 → past", (await say({ wants_from: at(-2), wants_to: at(-1) })) === "past");
  check("太远 → too_far", (await say({ wants_from: at(24 * 200), wants_to: at(24 * 200 + 1) })) === "too_far");
  check("结束早於开始 → bad_time", (await say({ wants_from: at(80), wants_to: at(79) })) === "bad_time");
  check("十小时的「预约」→ bad_time", (await say({ wants_from: at(90), wants_to: at(100) })) === "bad_time");

  /* 🔴 没上线的站，跟不存在的站，回**一样的东西**。 */
  const { data: unpub } = await stranger.rpc("submit_site_booking", {
    p_slug: draft.slug, visitor_name: "X", visitor_contact: "0123",
    wants_from: at(50), wants_to: at(51),
  });
  const { data: nobody } = await stranger.rpc("submit_site_booking", {
    p_slug: "there-is-no-such-shop-xyz", visitor_name: "X", visitor_contact: "0123",
    wants_from: at(50), wants_to: at(51),
  });
  check("🔴 没上线的站跟不存在的站，答案一模一样",
    unpub === "not_found" && nobody === "not_found", `${unpub} / ${nobody}`);

  /* 没有预约那一页的生意 —— **不是坏了，是这家不接预约**。 */
  const { data: noPage } = await stranger.rpc("submit_site_booking", {
    p_slug: noDiary.slug, visitor_name: "X", visitor_contact: "0123",
    wants_from: at(50), wants_to: at(51),
  });
  check("没有预约页的生意订不了", noPage === "not_found", String(noPage));

  /* ── ⑥ 洗版 ───────────────────────────────────────────────────────── */
  console.log("\n⑥ 一分钟里按很多次");
  let last = "";
  for (let i = 0; i < 8; i += 1) {
    last = (await stranger.rpc("submit_site_booking", {
      p_slug: salon.slug, visitor_name: `Spam ${i}`, visitor_contact: "0123",
      wants_from: at(120 + i * 2), wants_to: at(121 + i * 2),
    })).data;
  }
  check("🔴 按到第六次就挡住", last === "too_many", String(last));
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
