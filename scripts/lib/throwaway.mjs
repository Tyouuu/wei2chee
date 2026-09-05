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

/**
 * 跑到一半被杀掉的时候，也要把它删掉。
 *
 * ── 为什么（2026-09-05）──────────────────────────────────────────────────
 *
 * `finally` 只在**程式自己走完或抛错**的时候跑。而实际发生的是：
 * 我把输出接给 `head -14`，`head` 读够了就把管子关掉 ——
 * **进程当场死掉，`finally` 一行都没跑**，於是那个种了
 * 25 张单 · 15 笔钱 · 13 个人的临时帐号留在库里。
 *
 * 🔴 而它的代价不是「多一行垃圾」：`console_overview` 的「客户数」数的就是
 * `accounts`，而那是[老板拿来决定下一件做什么的那张后台](../../docs/founder-tasks.md#43)。
 * 那一天全系统体检把它读成「今天 05:48 那个帐号」，还得逐个查才分得出
 * 那是垃圾还是一个真的客户。
 *
 * ⚠️ 三个讯号都要接，因为它们是三件不同的事：
 *   · `SIGINT` —— 他按 Ctrl-C
 *   · `SIGTERM` —— 别人杀它
 *   · `EPIPE`  —— **接给 `head` / `tail` 的那一种**，最容易忘，而我就是这样漏的
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {() => (string | null | undefined)} currentUserId 现在建到哪一个
 */
export function dropThrowawayOnExit(admin, currentUserId) {
  let bailing = false;
  const bail = async (why) => {
    if (bailing) return;
    bailing = true;
    const id = currentUserId();
    if (id) {
      console.error(`
⚠️  被 ${why} 中断了 —— 先把临时帐号删掉再走`);
      await dropThrowaway(admin, id);
    }
    process.exit(130);
  };
  process.on("SIGINT", () => void bail("Ctrl-C"));
  process.on("SIGTERM", () => void bail("SIGTERM"));
  /* 管子被关掉（`| head`）。Node 把它变成写入时的 EPIPE，
     而没有人接的话就是一个未捕捉的例外 —— 进程死，`finally` 不跑。 */
  process.stdout.on("error", (e) => {
    if (e && e.code === "EPIPE") void bail("输出的管子被关掉");
  });
  process.on("uncaughtException", (e) => {
    if (e && e.code === "EPIPE") void bail("输出的管子被关掉");
    else throw e;
  });
}
