/**
 * 完工请她给一句评价 —— 真登入 + 一把没有登入过的钥匙（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 没做完之前留不了评价 —— can_review 只在 status = done 才是真的
 *   · 回一个词，不抛例外 —— 她是站在自己那次消费前面的人
 *   · 预设不给公开 —— review_may_show 要老板自己一个动作才翻
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
/* 一把从头到尾没有登入过的钥匙 —— 她拿着那条连结就是这个身分。 */
const stranger = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const anchor = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `rv-${tag}-${stamp}@formae.test`;
  const password = `Rv-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  people.push(data.user.id);
  return { id: data.user.id, email, client };
}
const say = async (client, fn, args) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await admin.from("projects").update({ business_name: "Xing Fa Salon" }).eq("id", P);
  await C.rpc("add_project_page", { requested_key: "bookings", new_title: "bookings" });
  await C.rpc("add_project_page", { requested_key: "customers", new_title: "customers" });

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const bookedId = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor + 864e5).toISOString(),
    in_ends_at: new Date(anchor + 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour",
  });
  const { data: bookedRow } = await admin
    .from("appointments").select("public_ref").eq("id", bookedId).single();
  const bookedRef = bookedRow.public_ref;

  console.log("\n① 还没做完之前——留不了评价，而她看得到「还不能」");
  const seenBooked = await say(stranger, "public_appointment", { in_ref: bookedRef });
  check("🔴 can_review 是假的", seenBooked[0]?.can_review === false, JSON.stringify(seenBooked[0]));
  const tooEarly = await say(stranger, "submit_appointment_review", {
    in_ref: bookedRef, in_rating: 5, in_text: "太快了",
  });
  check("回的是 not_yet，不是资料库的错误讯息", tooEarly === "not_yet", tooEarly);

  const doneId = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor - 36e5).toISOString(),
    in_ends_at: new Date(anchor).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Cut",
  });
  await say(C, "set_appointment_status", { in_id: doneId, in_status: "done" });
  const { data: doneRow } = await admin
    .from("appointments").select("public_ref").eq("id", doneId).single();
  const ref = doneRow.public_ref;

  console.log("\n② 🔴 做完了——她看得到可以留评价了");
  const seenDone = await say(stranger, "public_appointment", { in_ref: ref });
  check("can_review 是真的", seenDone[0]?.can_review === true, JSON.stringify(seenDone[0]));
  check("还没有留过——review_rating 是空的", seenDone[0]?.review_rating == null,
    String(seenDone[0]?.review_rating));

  console.log("\n③ 🔴 她留了一句");
  const submitted = await say(stranger, "submit_appointment_review", {
    in_ref: ref, in_rating: 5, in_text: "師傅很細心，剪得很滿意",
  });
  check("回的是 ok", submitted === "ok", submitted);
  const seenAfter = await say(stranger, "public_appointment", { in_ref: ref });
  check("🔴 现在看得到自己留的那一句", seenAfter[0]?.review_rating === 5
    && seenAfter[0]?.review_text === "師傅很細心，剪得很滿意",
    JSON.stringify(seenAfter[0]));
  check("而 can_review 现在是假的——不能再留一次", seenAfter[0]?.can_review === false,
    String(seenAfter[0]?.can_review));

  console.log("\n④ 🔴 再留一次，讲得出「已经留过了」");
  const again = await say(stranger, "submit_appointment_review", {
    in_ref: ref, in_rating: 1, in_text: "改变主意了",
  });
  check("回的是 already_submitted，不是资料库的错误讯息",
    again === "already_submitted", again);
  const unchanged = await say(stranger, "public_appointment", { in_ref: ref });
  check("🔴 原来那句没有被盖掉", unchanged[0]?.review_rating === 5, String(unchanged[0]?.review_rating));

  console.log("\n⑤ 拒绝的每一种");
  const badRatingRef = doneRow.public_ref;
  const anotherDone = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor - 144e5).toISOString(),
    in_ends_at: new Date(anchor - 108e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Blowdry",
  });
  await say(C, "set_appointment_status", { in_id: anotherDone, in_status: "done" });
  const { data: anotherRow } = await admin
    .from("appointments").select("public_ref").eq("id", anotherDone).single();
  check("🔴 0 分挡下来", (await say(stranger, "submit_appointment_review", {
    in_ref: anotherRow.public_ref, in_rating: 0, in_text: "",
  })) === "invalid", "居然让它过了");
  check("🔴 6 分挡下来", (await say(stranger, "submit_appointment_review", {
    in_ref: anotherRow.public_ref, in_rating: 6, in_text: "",
  })) === "invalid", "居然让它过了");
  check("🔴 两千字以上挡下来", (await say(stranger, "submit_appointment_review", {
    in_ref: anotherRow.public_ref, in_rating: 5, in_text: "长".repeat(2001),
  })) === "too_long", "居然让它过了");
  check("门牌是假的，回 not_found", (await say(stranger, "submit_appointment_review", {
    in_ref: "00000000-0000-0000-0000-000000000000", in_rating: 5, in_text: "",
  })) === "not_found", "居然让它过了");

  console.log("\n⑥ 🔴 老板看得到那一份清单，而预设不给公开");
  const list = await say(C, "reviews_of", { in_project_id: P });
  check("那一句评价在清单上", list.some((r) => r.review_text === "師傅很細心，剪得很滿意"),
    JSON.stringify(list));
  check("🔴 预设不给公开", list.every((r) => r.may_show === false),
    JSON.stringify(list.map((r) => r.may_show)));
  const theReview = list.find((r) => r.review_text === "師傅很細心，剪得很滿意");

  console.log("\n⑦ 🔴 老板问过她之后翻成可以公开");
  const shown = await say(C, "set_review_may_show", { in_id: theReview.id, in_may_show: true });
  check("那一笔翻成可以公开了", shown?.review_may_show === true, String(shown?.review_may_show));
  const listAfter = await say(C, "reviews_of", { in_project_id: P });
  const others = listAfter.filter((r) => r.id !== theReview.id);
  check("而其他没留过的、留过没被翻的，还是不给公开",
    others.every((r) => r.may_show === false), JSON.stringify(others));

  console.log("\n⑧ 🔴 还没留过评价的，翻不了 may_show");
  const noReviewYet = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor + 172e5).toISOString(),
    in_ends_at: new Date(anchor + 172e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour",
  });
  const { error: noReviewErr } = await C.rpc("set_review_may_show", {
    in_id: noReviewYet, in_may_show: true,
  });
  check("挡下来（no review to show yet）",
    (noReviewErr?.message ?? "").includes("no review to show yet"), noReviewErr?.message ?? "");

  console.log("\n⑨ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我这份清单", (await say(other.client, "reviews_of", { in_project_id: P })).length === 0,
    "他读到了");
  const { error: otherFlipErr } = await other.client.rpc("set_review_may_show", {
    in_id: theReview.id, in_may_show: true,
  });
  check("🔴 别人家翻不了我这一笔", !!otherFlipErr, "他翻了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
