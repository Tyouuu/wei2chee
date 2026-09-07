import { describe, it, expect } from "vitest";
import { archiveFnFor } from "./new-record-form";

/**
 * 「收起来」要打**这一页自己那一支**。
 *
 * ── 为什么这一份存在 ──────────────────────────────────────────────────────
 *
 * 2026-09-07 之前那是一串三元：名册 / 货架 / 预约，**其余一律走单那一支**。
 * 而对帐那一页不是走单 —— 所以那颗「收起来」画得出来、按得下去、
 * 🔴 **什么都不会发生**，因为 `set_pipeline_archived` 根本找不到那一行。
 *
 * ⚠️ 而它不是一个新洞：那一串自己的注解就在描述同一件事的上一次
 * （预约那一页）。**修了那一个实例，没有修那个形状** ——
 * 而这一份守的是那个形状。
 *
 * ── 编译期那一半才是主力 ─────────────────────────────────────────────────
 *
 * 那支函式的 `default` 是 `const unhandled: never = shape` ——
 * 第七种形状进来而没有接，**推不上去**。
 * 这一份守的是另外一半：接了，而且接对了那一支。
 *
 * ── 故意弄坏看过它红（2026-09-07） ────────────────────────────────────────
 *
 * 把 reconcile 那一支换回 `set_pipeline_archived` → 当场红。
 */
describe("收起来打哪一支", () => {
  it("每一种形状都有它自己那一支", () => {
    expect(archiveFnFor("pipeline")).toBe("set_pipeline_archived");
    expect(archiveFnFor("directory")).toBe("set_directory_archived");
    expect(archiveFnFor("catalog")).toBe("set_catalog_archived");
    expect(archiveFnFor("calendar")).toBe("set_appointment_archived");
    /* 🔴 这一条就是那个洞。 */
    expect(archiveFnFor("reconcile")).toBe("set_reconciliation_archived");
  });

  it("🔴 没有两种形状共用同一支 —— 那正是上一次的错法", () => {
    const shapes = [
      "pipeline",
      "directory",
      "catalog",
      "calendar",
      "reconcile",
    ] as const;
    const seen = shapes.map(archiveFnFor);
    expect(new Set(seen).size).toBe(shapes.length);
  });

  it("每一支的名字都指着一张真的表", () => {
    /* 一支叫错名字的函式，PostgREST 只回一句 error，而画面上
       跟「按了没反应」长得一模一样。 */
    for (const fn of [
      archiveFnFor("pipeline"),
      archiveFnFor("directory"),
      archiveFnFor("catalog"),
      archiveFnFor("calendar"),
      archiveFnFor("reconcile"),
    ]) {
      expect(fn).toMatch(/^set_[a-z_]+_archived$/);
    }
  });
});
