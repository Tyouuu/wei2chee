/**
 * 示范帐号那一个 project 是哪一个 —— 一个地方答，九支尺子一起问。
 *
 * 🔴 为什么要有这个档案：
 * 2026-09-04（任务 129）示范帐号被删掉又重建，**新的 id 跟旧的不一样**。
 * 而当时有 **九支尺子各自把旧的 id 手抄了一份**：
 *
 *   align-site · check-consistency · check-table-search · shoot-find ·
 *   shoot-inbox · shoot-journey · shoot-landing-shots · shoot-ours · walk
 *
 * 九支从那天起全部对着一个不存在的 project 跑。`check:table-search` 是当场
 * 崩在第 13 行（`Cannot read properties of null`），其余几支拿到 null 之后
 * 各自用各自的方式歪下去。**而没有人知道** —— 一支崩在第一行的尺子，
 * 跟一支跑完全绿的尺子，在没有人跑它的时候长得一模一样。
 *
 * 这个仓库栽在「第二份手写拷贝」上至少七次了（489 个区块名、九份小标题、
 * 三份风格名单…）。第八次是九份 uuid。
 *
 * ⚠️ **找不到就抛，不给预设值。** 一个写死的后备 id 正是这件事发生的原因：
 * 它让「示范帐号没了」看起来像「示范帐号好好的」。
 */
export async function demoProject(db) {
  if (process.env.DEMO_PROJECT_ID) {
    const { data } = await db
      .from("projects")
      .select("id, account_id, site_slug")
      .eq("id", process.env.DEMO_PROJECT_ID)
      .maybeSingle();
    if (!data) throw new Error(`DEMO_PROJECT_ID 指着一个不存在的 project：${process.env.DEMO_PROJECT_ID}`);
    return withEmail(db, data);
  }

  /* `rebuild-demo.mjs` 建的就是这一个帐号。 */
  const { data: acct } = await db
    .from("accounts")
    .select("id, email")
    .eq("email", "tianyou.demo@formae.test")
    .maybeSingle();
  if (acct) {
    const { data } = await db
      .from("projects")
      .select("id, account_id, site_slug")
      .eq("account_id", acct.id)
      .maybeSingle();
    if (data) return { ...data, email: acct.email };
  }

  throw new Error(
    "找不到示范帐号（tianyou.demo@formae.test）。跑 `node scripts/rebuild-demo.mjs --write` 把它建回来，" +
      "或者在 .env.local 设 DEMO_PROJECT_ID。",
  );
}

async function withEmail(db, proj) {
  const { data } = await db.from("accounts").select("email").eq("id", proj.account_id).maybeSingle();
  if (!data) throw new Error(`project ${proj.id} 的帐号不见了`);
  return { ...proj, email: data.email };
}
