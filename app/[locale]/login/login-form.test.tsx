import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 登入按下去之后，那颗按钮不可以变回「登入」。
 *
 * ── 这一条守的是一整串，不是一颗按钮（2026-09-07）─────────────────────
 *
 *   `setPending(false)` 排在 `router.push` 前面
 *     → 下一页还没来，按钮已经变回「登入」
 *     → 他以为没反应，再按一次、再一次
 *     → **每一次都是一通真的呼叫**，按几次就被挡下来
 *     → 而那时候画面写的是「邮箱或密码不正确」
 *     → **他去重设一个没有坏的密码**，额度用得更快
 *
 * 两个地方各修一半：按钮一直转到画面换掉为止；被挡下来跟打错密码
 * 讲两句不同的话。⚠️ 少任何一半，那一串就还在。
 *
 * ⚠️ 量的是原始码不是画面 —— 那一串要重现得起一个真的限流，
 * 而那会把这台机上每一支尺的登入一起挡掉。
 */
const SRC = readFileSync(
  join(process.cwd(), "app", "[locale]", "login", "login-form.tsx"),
  "utf8",
);

describe("登入按下去之后", () => {
  it("成功那一条路上不放掉 pending —— 它转到画面换掉为止", () => {
    const at = SRC.indexOf("router.push(");
    expect(at, "找不到那一跳").toBeGreaterThan(0);
    /* 从「问它是不是 founder」到那一跳之间，不可以有人把它关掉。 */
    const from = SRC.indexOf('rpc("is_founder")');
    expect(from).toBeGreaterThan(0);
    expect(
      SRC.slice(from, at),
      "🔴 `setPending(false)` 又排到那一跳前面了 —— 见档头那一串",
    ).not.toContain("setPending(false)");
  });

  it("被挡下来跟打错密码讲两句不同的话", () => {
    for (const key of ["errorTooMany", "errorUnreachable"]) {
      expect(SRC, `少了 ${key} 那一支`).toContain(key);
    }
    expect(SRC, "没有看回传的 429").toContain("429");
  });

  it.each(["en", "zh"])("%s 那两句话都在", (lang) => {
    const dict = JSON.parse(
      readFileSync(join(process.cwd(), "messages", `${lang}.json`), "utf8"),
    ) as { auth: Record<string, string> };
    for (const key of ["errorTooMany", "errorUnreachable"]) {
      expect(dict.auth[key], `${lang} 少了 ${key}`).toBeTruthy();
    }
    /* 🔴 被挡下来的时候要讲清楚**密码没有坏** —— 少了那半句，
       他照样会去重设密码，而那正是这一整条要挡的结局。 */
    expect(
      dict.auth.errorTooMany,
      `${lang}: 那句话没有讲「你的密码没有问题」`,
    ).toMatch(/password is fine|密码没有问题/);
  });
});
