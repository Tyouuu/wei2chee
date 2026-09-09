/**
 * 客人放飞机 · 订金 —— 拿真的登入身分打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的四条：
 *   · **他还没讲那个次数的时候，系统一句话都不讲**（不是拿一个我发明的次数顶着）
 *   · 分母跟分子一起给 —— 来过四十次错过两次，跟来过两次错过两次，不是同一件事
 *   · 柜台看得到**这一个客人**的余额，看不到**全店**的欠款（9-09 他点头放开的）
 *   · 定规矩是老板的事，照规矩收是柜台的事
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

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `dep-${tag}-${stamp}@formae.test`;
  const password = `Dep-${stamp}-x!`;
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
const refused = async (client, fn, args) => {
  const { error } = await client.rpc(fn, args);
  return error?.message ?? "";
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "hearth" });
  for (const k of ["bookings", "customers", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: today } = await admin.rpc("today_myt");
  /* 过去的那几天 —— 一笔已经发生过的预约才有「来了 / 没来」。 */
  const at = (daysBack, hour) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - daysBack);
    d.setUTCHours(hour - 8);
    return d.toISOString();
  };

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const loyal = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Puan Aminah",
  });
  /* 🔴 缺了很多次的那一个 —— **这一位是控制组真正的靶**。
     ⚠️ 第一版我只拿缺过两次的 Mrs Tan 去量「他没讲就不讲话」，
     而弄坏那一版发明的预设正好是 3 —— 2 < 3，於是**坏掉的版本照样全绿**。
     一条分不出好坏的断言，跟一条什么都没守的断言长得一模一样（[任务 322]）。
     现在这一位缺了五次：不管谁发明 1 · 2 · 3 · 5 哪一个预设，都会被抓到。 */
  const often = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Lim",
  });

  /** 一笔已经过去的预约，讲好它的结局。 */
  const past = async (party, daysBack, hour, status) => {
    const id = await say(C, "add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: at(daysBack, hour), in_ends_at: at(daysBack, hour + 1),
      in_party: party.name ?? "", in_party_id: party.id, in_service: "Cut and colour",
    });
    await say(C, "set_appointment_status", { in_id: id, in_status: status });
    return id;
  };

  console.log("\n① 一开始，一个人都没有放过飞机");
  check("干净的帐号，名单是空的",
    (await say(C, "no_shows_of", { in_project_id: P })).length === 0,
    JSON.stringify(await say(C, "no_shows_of", { in_project_id: P })));

  console.log("\n② 🔴 他还没讲他的规矩");
  /* Mrs Tan 放了两次飞机、来过一次。 */
  await past({ ...her, name: "Mrs Tan" }, 30, 11, "no_show");
  await past({ ...her, name: "Mrs Tan" }, 20, 11, "no_show");
  await past({ ...her, name: "Mrs Tan" }, 10, 11, "done");
  /* Puan Aminah 来过三次，一次都没有缺。 */
  for (const d of [28, 18, 8]) await past({ ...loyal, name: "Puan Aminah" }, d, 15, "done");
  /* Mr Lim 缺了五次。 */
  for (const d of [40, 35, 25, 15, 5]) await past({ ...often, name: "Mr Lim" }, d, 9, "no_show");

  const advice0 = (await say(C, "deposit_advice", {
    in_project_id: P, in_party_id: her.id,
  }))[0];
  check("数得出她放过两次", advice0?.missed === 2, JSON.stringify(advice0));
  check("🔴 也数得出她来过一次（分母跟分子一起给）",
    advice0?.came === 1, String(advice0?.came));
  check("讲得出最后一次是几时", !!advice0?.last_missed_on, String(advice0?.last_missed_on));
  check(
    "🔴 而他还没讲那个次数 → **一句话都不讲**（不是拿一个发明的次数顶着）",
    advice0?.advise === false && advice0?.rule_after === null,
    JSON.stringify([advice0?.advise, advice0?.rule_after]),
  );
  /* 🔴 **控制组真正的那一条** —— 缺五次照样不讲。见上面 Mr Lim 那一段。 */
  const many0 = (await say(C, "deposit_advice", {
    in_project_id: P, in_party_id: often.id,
  }))[0];
  check(
    "🔴 缺了五次的那一个也不讲 —— 他没给数字，系统就没有数字",
    many0?.missed === 5 && many0?.advise === false && many0?.rule_after === null,
    JSON.stringify(many0),
  );

  console.log("\n③ 🔴 他问回来了，填进去");
  await say(C, "set_booking_rules", {
    in_project_id: P, in_no_show_deposit_after: 2, in_default_deposit_cents: 5000,
  });
  const advice1 = (await say(C, "deposit_advice", {
    in_project_id: P, in_party_id: her.id,
  }))[0];
  check("🔴 现在它讲话了", advice1?.advise === true, JSON.stringify(advice1));
  check("而且讲得出是照哪一条规矩", advice1?.rule_after === 2, String(advice1?.rule_after));
  check("建议收多少也是他自己那个数字",
    Number(advice1?.suggest_cents) === 5000, String(advice1?.suggest_cents));

  const good = (await say(C, "deposit_advice", {
    in_project_id: P, in_party_id: loyal.id,
  }))[0];
  check(
    "🔴 而来过三次没缺过的那一个，照样不讲（不然这条规矩对每个人都成立）",
    good?.advise === false && good?.missed === 0 && good?.came === 3,
    JSON.stringify(good),
  );

  console.log("\n④ 名单");
  const list = await say(C, "no_shows_of", { in_project_id: P });
  check("🔴 只列有缺过的那几个（一次都没缺的不在里面）",
    list.length === 2 && !list.some((r) => r.party === "Puan Aminah"),
    JSON.stringify(list.map((r) => r.party)));
  check("🔴 缺最多的排最前面", list[0]?.party === "Mr Lim", String(list[0]?.party));
  const hers = list.find((r) => r.party === "Mrs Tan");
  check("她那一行是两次 · 来过一次", hers?.missed === 2 && hers?.came === 1,
    JSON.stringify(hers));

  console.log("\n⑤ 一单挂一个订金");
  const soon = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(-2, 11), in_ends_at: at(-2, 12),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Cut and colour",
  });
  const put = await say(C, "set_appointment_deposit", {
    in_id: soon, in_amount_cents: 5000,
  });
  check("挂得上去", Number(put?.deposit_cents) === 5000, String(put?.deposit_cents));
  const cleared = await say(C, "set_appointment_deposit", { in_id: soon });
  check("🔴 不给就是这一单不用订金（null，不是 0）",
    cleared?.deposit_cents === null, String(cleared?.deposit_cents));
  const zero = await say(C, "set_appointment_deposit", {
    in_id: soon, in_amount_cents: 0,
  });
  check("🔴 而 0 是「讲好了不收」—— 跟没讲不一样",
    Number(zero?.deposit_cents) === 0, String(zero?.deposit_cents));
  check("负数挡下来",
    (await refused(C, "set_appointment_deposit", { in_id: soon, in_amount_cents: -1 }))
      .includes("less than nothing"), "居然让它过了");

  console.log("\n⑥ 她手上还有多少");
  await say(C, "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 5000, in_party: "Mrs Tan", in_party_id: her.id,
  });
  const paid = (await say(C, "deposit_advice", {
    in_project_id: P, in_party_id: her.id,
  }))[0];
  check("🔴 收了订金之后，她手上那个数字看得到",
    Number(paid?.on_hand_cents) === 5000, String(paid?.on_hand_cents));

  console.log("\n⑦ 🔴 美发师（看得到这个客人，看不到全店的钱）");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  const asCrew = (await say(crew.client, "deposit_advice", {
    in_project_id: P, in_party_id: her.id,
  }))[0];
  check("🔴 她放过几次，柜台看得到（这一支就是给柜台的）",
    asCrew?.missed === 2 && asCrew?.came === 1, JSON.stringify(asCrew));
  /* 🔴 2026-09-09 他点头放开了（20260909350000）：柜台看得到
     **这一个客人**自己的余额 —— 那是她每天要讲出口的一句话，
     而客人自己就知道那个数字（她就是付钱的那一个）。
     ⚠️ 对照组在下面：全店那张欠款总表照旧挡着。少了那一条，
     「放开了」跟「本来就没挡」在报告里长得一模一样。 */
  check("🔴 柜台看得到她手上还剩多少（他 9-09 点头放开的）",
    Number(asCrew?.on_hand_cents) === 5000, String(asCrew?.on_hand_cents));
  check("也看得到建议收多少（不然她开不了口）",
    Number(asCrew?.suggest_cents) === 5000, String(asCrew?.suggest_cents));
  check("⚠️ 而老板同一个呼叫读到同一个数字",
    Number(paid?.on_hand_cents) === 5000, "老板自己也读不到");
  check(
    "🔴 对照组：全店那张「谁欠我钱」柜台照旧读不到",
    (await say(crew.client, "party_debts", { in_project_id: P })).length === 0,
    "他读到了全店的欠款",
  );
  check("🔴 柜台照旧挂得上订金（照规矩收是他的事）",
    (await refused(crew.client, "set_appointment_deposit", {
      in_id: soon, in_amount_cents: 5000,
    })) === "", "它把柜台挡下来了");
  check("🔴 但改不了那条规矩（定规矩是老板的事）",
    (await refused(crew.client, "set_booking_rules", {
      in_project_id: P, in_no_show_deposit_after: 1,
    })).includes("for the owner"), "它让他改了");

  console.log("\n⑧ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我的名单",
    (await say(other.client, "no_shows_of", { in_project_id: P })).length === 0,
    "他读到了");
  check("🔴 别人家问不了我的客人",
    !!(await refused(other.client, "deposit_advice", {
      in_project_id: P, in_party_id: her.id,
    })), "他问到了");
  check("🔴 别人家挂不了我的订金",
    !!(await refused(other.client, "set_appointment_deposit", {
      in_id: soon, in_amount_cents: 100,
    })), "他挂上了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
