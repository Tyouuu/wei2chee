"use client";

import { useState, type ReactNode } from "react";

/**
 * 一张记录页右边那一长条，分成几个分页签——真的去看后台系统的参考才动手
 * 的（arhamkhnz `Profile details` 那一页，`.screenshots/admins/arham-
 * profile.jpg`：抬头 ＋ 头像之后就是 Overview / Personal / Employment /
 * Compensation / Time off / Documents 一排页签，不是一条到底）。
 *
 * ── 为什么[任务 273] 记的顾虑在这里不成立 ─────────────────────────────────
 *
 * 那一条 2026-09-07 登记的是「分页签会把段落自己的标题印两次」——因为它设想
 * 的是**一段一个页签**（`runHeading` 直接拿去当页签的字）。这里反过来：
 * 页签的字是**一组的名字**（Overview / Activity），底下装的是好几段，
 * 每一段自己的 `<h2>` 还是自己的字（Paid, not yet used / Gift credit
 * remaining……）——页签的字跟任何一段自己的标题都不是同一句话，不会重复。
 *
 * ── 只在真的挤成一长条的那一页用，其余页面原样不动 ────────────────────────
 *
 * 这个共用的「读」栏服务十几种形状（客户 · 预约 · 单据 · 师傅……），
 * 每一种形状看到的段落数量差很多——预约那一页收合过（[任务 403]）之后
 * 已经只剩两三段，用页签反而是多一层。**这一支只接客户那一页**，
 * 其余形状照旧一条到底，不做同一件事第二次。
 *
 * ── CSS 隐藏，不是卸载 ────────────────────────────────────────────────────
 *
 * 切页签用 `hidden`（[重点 22c] 同一个仓库的既有惯例：`[hidden]{display:
 * none}` 而不是条件渲染），不在的那个页签底下的表单不会被卸载重挂——
 * 客户在「Overview」页签半填了一个「充值」表单，切去「Activity」再切
 * 回来，草稿还在，不会因为换页签就消失。
 */
export function RecordTabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const real = tabs.filter((t) => t.content != null);
  const [active, setActive] = useState(real[0]?.key ?? "");

  if (real.length <= 1) {
    // 只剩一组有东西——页签本身就是多余的一层，直接摊开。
    return <>{real.map((t) => <div key={t.key}>{t.content}</div>)}</>;
  }

  return (
    <div>
      <div
        role="tablist"
        className="flex gap-1 border-b [border-color:var(--color-ink-800)]"
      >
        {real.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={
              active === t.key
                ? "-mb-px [border-radius:var(--radius-sm)_var(--radius-sm)_0_0] border border-b-0 px-4 py-2 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [border-color:var(--color-ink-800)] [background-color:var(--color-canvas)] text-[color:var(--color-on-canvas)]"
                : "-mb-px border border-b-0 border-transparent px-4 py-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] hover:text-[color:var(--color-on-canvas)]"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {real.map((t) => (
        <div
          key={t.key}
          hidden={active !== t.key}
          className="pt-8 [&>*:first-child]:mt-0 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
