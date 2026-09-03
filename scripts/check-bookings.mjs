/**
 * 预约 — every function called for real, by a real customer, over RLS.
 *
 * The centre of it is the clash rule. easyappointments checks for one in PHP,
 * between a SELECT and an INSERT, and a booking page is exactly where two
 * people press at once -- they are both looking at the same three free slots on
 * a Saturday morning. This is a database constraint instead, so the assertions
 * below include two writes fired at the same instant with no await between
 * them: if the rule were application code, both would land.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
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

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];
async function business(tag) {
  const cred = {
    email: `book-${tag}-${Date.now()}@formae.test`,
    password: `Book-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", user.user.id)
    .single();
  if (!proj?.id) throw new Error(`${tag} was provisioned no project`);
  /* The error is READ -- a sibling script once wrote to a column that does not
     exist and reported nine failures against correct code. */
  const { error: upErr } = await admin
    .from("projects")
    .update({ style: "hearth", palette: "clean-slate", system_language: "en" })
    .eq("id", proj.id);
  if (upErr) throw new Error(`provision(${tag}): ${upErr.message}`);

  for (const key of ["bookings", "staff", "customers"]) {
    await as.rpc("add_project_page", { requested_key: key, new_title: null });
  }
  return { as, id: proj.id };
}

/** A slot tomorrow, so nothing here depends on the hour this runs at. */
const at = (hour, minutes = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour, minutes, 0, 0);
  return d.toISOString();
};

try {
  const a = await business("a");

  /* ⚠️ add_directory_entry RETURNS THE WHOLE ROW, not an id. The first run
     passed the object straight into a uuid parameter and twelve assertions
     failed against a table that was fine -- 「invalid input syntax for type
     uuid: {"id":"3a6b...","project_id":...}」. Fourth ruler at fault today. */
  const idOf = (d) => (Array.isArray(d) ? d[0] : d)?.id ?? d;
  const { data: jasRow } = await a.as.rpc("add_directory_entry", {
    in_project_id: a.id,
    in_module_key: "staff",
    in_name: "Jasmine",
  });
  const { data: meiRow } = await a.as.rpc("add_directory_entry", {
    in_project_id: a.id,
    in_module_key: "staff",
    in_name: "Mei",
  });
  const jas = idOf(jasRow);
  const mei = idOf(meiRow);

  console.log("\n约一个时段:");
  const { data: id1, error: e1 } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(2),
    in_ends_at: at(3),
    in_party: "Ang Chee Keong",
    in_staff_id: jas,
    in_service: "Cut + colour",
  });
  check("a customer can book one", !!id1 && !e1, e1?.message ?? "");

  const { data: row } = await a.as
    .from("appointments")
    .select("*")
    .eq("id", id1)
    .maybeSingle();
  check("it starts as booked", row?.status === "booked", String(row?.status));
  check("it knows it was taken by hand, not from the website", row?.source === "staff");
  check("it has a link that needs no login", !!row?.public_ref);
  check("and it remembers when it was made, not only when it is", !!row?.booked_at);

  console.log("\n同一个师傅，同一个时段:");
  const { error: eClash } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(2, 30),
    in_ends_at: at(3, 30),
    in_party: "Someone else",
    in_staff_id: jas,
  });
  check("the second one is refused", !!eClash, "it was accepted");
  /* 🔴 A SALON OWNER MUST NOT READ 「conflicting key value violates exclusion
     constraint」. That sentence teaches him nothing he can act on. */
  check("and refused in words he can act on",
    /already taken/i.test(eClash?.message ?? ""), eClash?.message ?? "");

  console.log("\n另一个师傅，同一个时段:");
  const { data: id2, error: eMei } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(2, 30),
    in_ends_at: at(3, 30),
    in_party: "Someone else",
    in_staff_id: mei,
  });
  check("a different stylist at the same hour is fine", !!id2 && !eMei, eMei?.message ?? "");

  console.log("\n午餐也占位:");
  const { data: block, error: eBlock } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(5),
    in_ends_at: at(6),
    in_staff_id: jas,
    in_kind: "block",
    in_note: "Lunch",
  });
  check("time off needs no customer", !!block && !eBlock, eBlock?.message ?? "");
  const { error: eOverLunch } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(5, 15),
    in_ends_at: at(5, 45),
    in_party: "Walk in",
    in_staff_id: jas,
  });
  check("and nothing can be booked over it", !!eOverLunch, "it was accepted");

  console.log("\n取消了就放开那个时段:");
  await a.as.rpc("set_appointment_status", { in_id: id1, in_status: "cancelled" });
  const { data: id3, error: eAfter } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(2),
    in_ends_at: at(3),
    in_party: "Next customer",
    in_staff_id: jas,
  });
  check("the slot is free again", !!id3 && !eAfter, eAfter?.message ?? "");
  const { data: still } = await a.as
    .from("appointments")
    .select("status")
    .eq("id", id1)
    .maybeSingle();
  check("and the cancelled one is still on the books", still?.status === "cancelled");

  console.log("\n一个人的店 —— 没写师傅也不准撞:");
  const solo = await business("solo");
  const { data: s1 } = await solo.as.rpc("add_appointment", {
    in_project_id: solo.id,
    in_module_key: "bookings",
    in_starts_at: at(9),
    in_ends_at: at(10),
    in_party: "First",
  });
  check("a one-person shop can book", !!s1);
  const { error: eSolo } = await solo.as.rpc("add_appointment", {
    in_project_id: solo.id,
    in_module_key: "bookings",
    in_starts_at: at(9, 30),
    in_ends_at: at(10, 30),
    in_party: "Second",
  });
  /* Without the coalesce this would be accepted, and a per-staff rule would
     protect the businesses that need it least. */
  check("and cannot double-book itself with nobody named", !!eSolo, "it was accepted");

  console.log("\n两个人同一秒按下去:");
  const race = await Promise.all(
    ["Racer A", "Racer B"].map((who) =>
      a.as.rpc("add_appointment", {
        in_project_id: a.id,
        in_module_key: "bookings",
        in_starts_at: at(14),
        in_ends_at: at(15),
        in_party: who,
        in_staff_id: mei,
      }),
    ),
  );
  const won = race.filter((r) => !r.error).length;
  /* 🔴 THE ASSERTION THE WHOLE CONSTRAINT EXISTS FOR. Check-then-insert in
     application code lets both of these land, and two customers turn up for
     the same chair. */
  check("exactly one of two simultaneous bookings lands", won === 1,
    `${won} landed — ${race.map((r) => r.error?.message ?? "ok").join(" | ")}`);

  console.log("\n不得乱写:");
  const { error: eBack } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(20),
    in_ends_at: at(19),
    in_party: "Backwards",
  });
  check("an appointment cannot end before it starts", !!eBack, "it was accepted");
  const { error: eNobody } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "bookings",
    in_starts_at: at(21),
    in_ends_at: at(22),
  });
  check("a booking with nobody in it is refused", !!eNobody, "it was accepted");
  const { error: eShape } = await a.as.rpc("add_appointment", {
    in_project_id: a.id,
    in_module_key: "payments",
    in_starts_at: at(21),
    in_ends_at: at(22),
    in_party: "X",
  });
  check("a page that is not this shape is refused", !!eShape, "it was accepted");
  const { error: eStatus } = await a.as.rpc("set_appointment_status", {
    in_id: id2,
    in_status: "maybe",
  });
  check("a status an appointment cannot be in is refused", !!eStatus, "it was accepted");

  console.log("\n没来 —— 只记，不动钱:");
  await a.as.rpc("set_appointment_status", { in_id: id2, in_status: "no_show" });
  const { data: noshow } = await a.as
    .from("appointments")
    .select("status")
    .eq("id", id2)
    .maybeSingle();
  check("it records that they did not turn up", noshow?.status === "no_show");
  const { data: money } = await a.as.from("ledger_entries").select("id").eq("project_id", a.id);
  /* 任务 44 lists 「no-show 怎么处理」 as the founder's to settle. Until it is
     settled this records what happened and touches nothing else -- inventing a
     charge would be us writing a commercial rule nobody agreed to. */
  check("and does not invent a charge nobody agreed to", (money ?? []).length === 0,
    `${(money ?? []).length} ledger rows appeared`);

  console.log("\n单号:");
  const { error: eDoc } = await a.as.rpc("next_doc_no", {
    in_project_id: a.id,
    in_module_key: "bookings",
  });
  check("a booking is never given a document number", !!eDoc, "it issued one");

  console.log("\n安全 — 别人碰不到:");
  const b = await business("b");
  const { data: theirs } = await b.as.from("appointments").select("id");
  check("another business sees none of them", (theirs ?? []).length === 0,
    `${(theirs ?? []).length} rows`);
  const { error: eSteal } = await b.as.rpc("update_appointment", {
    in_id: id3,
    in_starts_at: at(2),
    in_ends_at: at(3),
    in_party: "stolen",
  });
  check("nor move one", !!eSteal, "the update was accepted");
  const { error: eStatus2 } = await b.as.rpc("set_appointment_status", {
    in_id: id3,
    in_status: "cancelled",
  });
  check("nor cancel one", !!eStatus2, "the cancel was accepted");

  console.log("\n判：");
  console.log(`  ${failed.length ? `${failed.length} FAILED` : "all good"}`);
} finally {
  for (const id of made) await dropThrowaway(admin, id);
}

process.exit(failed.length ? 1 : 0);
