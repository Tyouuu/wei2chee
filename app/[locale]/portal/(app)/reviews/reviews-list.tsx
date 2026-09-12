"use client";

import { useState } from "react";
import { ReviewVisibility } from "./review-visibility";
import { deskField } from "../desk-kit";

/**
 * 一年下来评价会有几十上百句——[重点 36] 讲的那种「会长的清单」，
 * 搜寻／筛选在画这一页的时候就要一起做，不是资料多了才回来补。
 *
 * 找人：按客人的名字／服务项目找，跟 `treatment-desk.tsx` 那个 `find`
 * 同一条做法。评星：按几颗星筛，因为老板最常问的下一句就是
 * 「有没有差评」，不是「按名字找到某一句」。
 *
 * ⚠️ **每一句要显示的字都是伺服器先拼好的**（`submittedLabel` ·
 * `starOptions` 的 `label`），不是这个客户端组件自己再拼一次——
 * 那正是这个仓库撞过的坑（`{time}` 那次，`t()` 没有在伺服器端拿到参数，
 * 画面上印出一整串键名）。伺服器元件也不能把一个函式当 prop
 * 传给客户端元件，两个理由指向同一个做法。
 */
export type Review = {
  id: string;
  party: string;
  service: string;
  rating: number;
  review_text: string;
  submittedLabel: string;
  may_show: boolean;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span
      aria-label={`${rating}/5`}
      className="[font-size:var(--text-base)] tracking-wide"
      style={{ color: "var(--color-brass-bright)" }}
    >
      {"★★★★★".slice(0, rating)}
      <span style={{ color: "var(--color-on-canvas-dim)" }}>
        {"★★★★★".slice(rating)}
      </span>
    </span>
  );
}

export function ReviewsList({
  reviews,
  starOptions,
  copy,
}: {
  reviews: Review[];
  starOptions: { value: number; label: string }[];
  copy: {
    find: string;
    allRatings: string;
    none: string;
    noneFound: string;
    mayShow: string;
    mayNotShow: string;
    makePublic: string;
    makePrivate: string;
    saving: string;
  };
}) {
  const [find, setFind] = useState("");
  const [minStars, setMinStars] = useState(0);

  const shown = reviews.filter((r) => {
    if (minStars > 0 && r.rating < minStars) return false;
    const needle = find.trim().toLowerCase();
    if (!needle) return true;
    return (
      r.party.toLowerCase().includes(needle) ||
      r.service.toLowerCase().includes(needle)
    );
  });

  /* 🔴 一件都没有过（`reviews.length === 0`）跟「筛出来是空的」是两句
     不一样的话——见 [重点 36] 同一条纪律，答不出来的时候不要含糊：
     前者是「现在还没有人留过评价」，后者是「换一个条件再找找看」。 */
  if (reviews.length === 0) {
    return (
      <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {copy.none}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 只在真的超过一屏看得完的量才画筛选，见 [重点 36]：
          少于六句的时候，一个找不到东西可筛的搜寻框只是杂讯。 */}
      {reviews.length > 6 ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder={copy.find}
            className={`${deskField} max-w-xs`}
          />
          <select
            value={minStars}
            onChange={(e) => setMinStars(Number(e.target.value))}
            className={deskField}
          >
            <option value={0}>{copy.allRatings}</option>
            {starOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.noneFound}
        </p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 border-t py-4 first:border-t-0 [border-color:var(--color-ink-800)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="[font-weight:var(--fw-medium)]">
                  {r.party}
                  {r.service ? (
                    <span className="[font-weight:var(--fw-regular)] text-[color:var(--color-on-canvas-dim)]">
                      {" · "}
                      {r.service}
                    </span>
                  ) : null}
                </span>
                <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                  {r.submittedLabel}
                </span>
              </div>
              <Stars rating={r.rating} />
              {r.review_text ? (
                <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                  {r.review_text}
                </p>
              ) : null}
              <ReviewVisibility id={r.id} mayShow={r.may_show} copy={copy} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
