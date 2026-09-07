import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { usePeriodLock, PeriodLock } from "./period-lock";
import { RECORD_COPY } from "../record-copy";

/**
 * 那个月他签过帐了 —— 而**读不到的时候不准挡**。
 *
 * ── 这一份守的四条 ────────────────────────────────────────────────────────
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
 * 4. 🔴 **答案要跟着他现在填的那一天走。** 他把六月改成八月，
 *    上一趟的答案还在飞 —— 一个只存 boolean 的版本会在那两秒里
 *    对着八月讲六月那一句，而画面上完全看不出来。
 *
 * ── 四条都故意弄坏看过它红（2026-09-07） ──────────────────────────────────
 *
 * 让错误塌成「锁着」→ 第 2 条红；拿掉那一句早退 → 第 3 条红；
 * 把状态换回一个光秃秃的 boolean → 第 4 条红。
 */

const copy = RECORD_COPY.en.form;
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}));

/* ⚠️ 大括号不可以省。`mockReset()` 回的是那个 mock 函式本身，而 vitest
   把 `beforeEach` 回传的函式当成**收尾函式**去呼叫 —— 於是上一题留下的
   那个永远不 resolve 的 promise 变成了收尾，整个 hook 卡满十秒，
   而报出来的是「Hook timed out」，看起来跟产品完全无关。 */
beforeEach(() => {
  rpc.mockReset();
});

/** 那支 hook 跟那一格摆在一起，因为产品就是这样用它的。 */
function Harness({ on }: { on: string }) {
  const locked = usePeriodLock({ projectId: "p1", on, direction: "out" });
  return (
    <>
      <span data-testid="answer">{String(locked)}</span>
      <PeriodLock locked={locked} copy={copy} />
    </>
  );
}

const answer = () => screen.getByTestId("answer").textContent;

describe("那个月签过了", () => {
  it("锁着就讲，而且讲得出该怎么做", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    render(<Harness on="2026-06-14" />);
    await waitFor(() =>
      expect(screen.getByText(copy.periodLocked)).toBeTruthy(),
    );
    /* 一句只会说「不行」的拒绝，是一个比较礼貌的死路。 */
    expect(copy.periodLocked.toLowerCase()).toContain("reopen");
    expect(answer()).toBe("true");
  });

  it("没锁就一个字都不画", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    render(<Harness on="2026-06-14" />);
    await waitFor(() => expect(answer()).toBe("false"));
    expect(screen.queryByText(copy.periodLocked)).toBeNull();
  });

  it("🔴 读不到不挡 —— 那不是「锁着」", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    render(<Harness on="2026-06-14" />);
    await waitFor(() => expect(answer()).toBe("false"));
    /* 🔴 这一条是整份的靶：读不到的时候那颗保存钮必须还按得动。 */
    expect(screen.queryByText(copy.periodLocked)).toBeNull();
  });

  it("没填日子就不去问", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    render(<Harness on="" />);
    await waitFor(() => expect(answer()).toBe("null"));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("🔴 他改了日子，上一天的答案不算数", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const { rerender } = render(<Harness on="2026-06-14" />);
    await waitFor(() => expect(answer()).toBe("true"));
    /* 换成一个还没有答案的日子 —— 那两秒里不可以还讲着六月那一句。 */
    rpc.mockReturnValue(new Promise(() => {}));
    rerender(<Harness on="2026-08-20" />);
    expect(answer()).toBe("null");
    expect(screen.queryByText(copy.periodLocked)).toBeNull();
  });

  it("问的是他填的那一天跟这一页的方向", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    render(<Harness on="2026-06-14" />);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(rpc.mock.calls[0][0]).toBe("is_period_locked");
    expect(rpc.mock.calls[0][1]).toMatchObject({
      in_project_id: "p1",
      in_on: "2026-06-14",
      in_direction: "out",
    });
  });
});
