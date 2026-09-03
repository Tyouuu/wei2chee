/**
 * 删掉一个用完就丢的测试帐号 —— **而且删不掉的时候要叫出来。**
 *
 * ── 为什么这一支要存在（2026-09-04）────────────────────────────────────────
 *
 * 十六支脚本各自建一个 `@formae.test` 的帐号，跑完在 `finally` 里删掉，
 * 然后印一句「临时帐号删掉了」。
 *
 * **那句话讲了三个星期，而它一直是假的。**
 *
 * `supabase-js` 的 `deleteUser` **不会 reject**，它回一个 `{ error }`。
 * 八支写了 `.catch(() => {})`（对一个不会 reject 的东西 catch），
 * 另外八支连回传值都没看 —— 十六支没有一支看得到那句
 * `Database error deleting user`。
 *
 * 代价是真的：资料库里堆到 **46 个帐号里 45 个是垃圾**，而
 * `console_overview` 的 `customers_total` 数的就是 `accounts` ——
 * [老板自己那张后台](../../docs/founder-tasks.md#43)（他拿来决定下一件做什么的那一张）
 * **回报他有 45 个客户，而他有 0 个**。
 *
 * 🔴 而它还有第二层代价，比第一层大：我为了清那 45 个，写了一句
 * `/@formae\.test$/` 加一个 for 回圈 ——
 * **`tianyou.demo@formae.test` 就在那一串里面**，那是老板拿来给人看的那一个。
 * 见 `scripts/rebuild-demo.mjs`。
 *
 * ── 所以这一支只做两件事 ──────────────────────────────────────────────────
 *
 *   1. **看那个 error**，删不掉就印出来并且回 false
 *   2. **只删你自己刚刚建的那个 id** —— 它不收 email、不收正则、不列举。
 *      一支照 pattern 扫全库的清理程式，正是我今天用来炸掉 demo 的那把枪
 */

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin  service-role client
 * @param {string | null | undefined} userId  刚刚建的那一个
 * @returns {Promise<boolean>} 真的删掉了没有
 */
export async function dropThrowaway(admin, userId) {
  if (!userId) return true;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (!error) return true;
  console.error(
    `\n🔴 删不掉那个临时帐号 ${userId}：${error.message}` +
      `\n   它会留在 accounts 里，而 console 的「客户数」会把它算进去。`,
  );
  return false;
}

/** 一次几个（有些脚本会建老板＋师傅两个）。回删不掉的那几个。 */
export async function dropThrowaways(admin, userIds) {
  const stuck = [];
  for (const id of userIds ?? []) {
    if (!(await dropThrowaway(admin, id))) stuck.push(id);
  }
  return stuck;
}
