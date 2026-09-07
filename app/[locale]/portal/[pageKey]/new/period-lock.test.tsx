import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PeriodLock } from "./period-lock";
import { RECORD_COPY } from "../record-copy";

/**
 * 那个月他签过帐了 —— 而**读不到的时候不准挡**。
 *
 * ── 这一份守的三条 ────────────────────────────────────────────────────────
 *
 * 1. **锁着就讲，而且讲得出出路。** 20260905740000 那一条自己的收尾写着
 *    这一格该存在：今天他按下去才读到一句资料库的英文。
 *
 * 2. 🔴 **读不到 ≠ 锁着。** 断网、那一支出错、权限变了 —— 三种都回错误，
 *    而三种都**不可以**变成一颗灰掉的保存钮。一个因为读不到而挡住他记帐的
 *    画面，比一句迟来的英文糟得多；资料库那一层照旧会拒绝（31 条断言），
 *    所以这一格是第二道，不是唯一那一道。
 *
 * 3. **没填日子就不去问。** 空的 = 今天，而今天照定义锁不了
 *    （规矩 ①：只锁已经过完的月份）—— 问了也是白问，而那一趟是他打开
 *    每一张收款单都要付的钱。
 *
 * ── 三条都故意弄坏看过它红（2026-09-07） ──────────────────────────────────
 *
 * 把 `error ? null : data === true` 改成 `data === true`（也就是让错误
 * 塌成「没锁」以外的任何一种读法）→ 第 2 条当场红；
 * 拿掉那一句早退 → 第 3 条红。
 */

const copy = RECORD_COPY.en.form;
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}));

beforeEach(() => rpc.mockReset());

const draw = (on: string, onLocked = () => {}) =>
  render(
    <PeriodLock
      projectId="p1"
      on={on}
      direction="out"
      copy={copy}
      onLocked={onLocked}
    />,
  );

describe("那个月签过了", () => {
  it("锁着就讲，而且讲得出该怎么做", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const seen: boolean[] = [];
    draw("2026-06-14", (v) => seen.push(v));
    await waitFor(() =>
      expect(screen.getByText(copy.periodLocked)).toBeTruthy(),
    );
    /* 一句只会说「不行」的拒绝，是一个比较礼貌的死路。 */
    expect(copy.periodLocked.toLowerCase()).toContain("reopen");
    expect(seen).toContain(true);
  });

  it("没锁就一个字都不画", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const seen: boolean[] = [];
    const { container } = draw("2026-06-14", (v) => seen.push(v));
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(container.textContent).toBe("");
    expect(seen).not.toContain(true);
  });

  it("🔴 读不到不挡 —— 那不是「锁着」", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const seen: boolean[] = [];
    const { container } = draw("2026-06-14", (v) => seen.push(v));
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(container.textContent).toBe("");
    /* 🔴 这一条是整份的靶：读不到的时候那颗保存钮必须还按得动。 */
    expect(seen).not.toContain(true);
  });

  it("没填日子就不去问", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const seen: boolean[] = [];
    draw("", (v) => seen.push(v));
    await waitFor(() => expect(seen).toContain(false));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("问的是他填的那一天跟这一页的方向", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    draw("2026-06-14");
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(rpc.mock.calls[0][0]).toBe("is_period_locked");
    expect(rpc.mock.calls[0][1]).toMatchObject({
      in_project_id: "p1",
      in_on: "2026-06-14",
      in_direction: "out",
    });
  });
});
