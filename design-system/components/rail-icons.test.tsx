/**
 * 侧栏上每一行都要有图标。
 *
 * 🔴 实拍（2026-09-05）：整条侧栏每一行都有图标，**只有「Website」那一行
 * 是光的字**，而它的位置比别人往左缩一格。
 *
 * 根因是这个仓库栽过至少八次的那一个：`RAIL_ICONS` 是一份**手写名单**，
 * 而模块目录从七个长到十八个。`railIcon()` 找不到就回 `null` ——
 * **不报错、不留痕迹**，所以它安静地少了两个。
 *
 * ⚠️ 「找不到就回 null」那条**故意留着**：一个客户自己加的页面本来就
 * 没有图标，那时候画成一行光的字是对的降级。
 * 这一条守的是**目录里那十八个**，不是所有名字。
 */
import { describe, expect, it } from "vitest";
import { RAIL_ICONS } from "./rail-icons";
import { MODULE_KEYS } from "@/lib/portal/module-catalog";

describe("RAIL_ICONS", () => {
  it("🔴 目录里每一个模块都有一个图标", () => {
    const missing = MODULE_KEYS.filter((k) => !RAIL_ICONS[k]);
    expect(missing, `这几个 key 在侧栏上会画成一行光的字：${missing.join(" · ")}`).toEqual([]);
  });

  it("底下那两行也有 —— 通知跟账号设置", () => {
    for (const k of ["notifications", "account"]) expect(RAIL_ICONS[k]).toBeTruthy();
  });

  it("⚠️ 而客户自己加的页面照旧没有 —— 那是降级，不是缺陷", () => {
    expect(RAIL_ICONS["a-page-he-invented"]).toBeUndefined();
  });
});
