"use client";

import type { RecordFormCopy } from "../record-copy";

/**
 * 帐单一个地方，工地另一个，而且可能有两三个工地。
 *
 * ── 一行，不是一张邮政表格 ────────────────────────────────────────────────
 *
 * Frappe 的 Address 有七栏（line1 · line2 · city · county · state · country ·
 * pincode），而且 `city` 是必填。一个工地写的是「Lot 42, Jalan Kebun」——
 * 它没有 city，而一张逼他填 city 的表格，他会随便打一个字进去。
 *
 * `region` 是分开的一栏，只因为**它是被筛的那一栏**（vibe-dealer 替它建了
 * 索引，正是这个理由）。其余全部是一行字。
 *
 * ── 标签是他自己的词 ──────────────────────────────────────────────────────
 *
 * 「工地」「档口」「仓库」「家」。Frappe 那个九个选项的下拉挡不住马来西亚
 * 八个行业，而 `stage` 跟 `status` 早就定过同一条：**他的词就是产品。**
 *
 * ── 「帐单寄这里」只能有一个 ──────────────────────────────────────────────
 *
 * 两个帐单地址不是一个设定，是一个打错的字。所以这里是**互斥**的：
 * 勾第二个，第一个自己松开 —— 而不是让他勾两个、保存的时候才被资料库拒绝。
 */

export type AddressRow = {
  /** 已经存起来的那一行自己的 id。新加的一行没有。
   *  只拿来对上「有没有单指着它」，不送回资料库（整批换会重发 id）。 */
  id?: string;
  label: string;
  line: string;
  region: string;
  isBilling: boolean;
};

export const blankAddress = (): AddressRow => ({
  label: "",
  line: "",
  region: "",
  isBilling: false,
});

/** 送进资料库的形状。没写地址的那几行丢掉 —— 他开了一行没写完，
 *  不是一个他要留下的地址。 */
export function addressesForDb(rows: AddressRow[]) {
  return rows
    .filter((r) => r.line.trim())
    .map((r) => ({
      label: r.label.trim(),
      line: r.line.trim(),
      region: r.region.trim(),
      is_billing: r.isBilling,
    }));
}

const control =
  "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";

export function AddressEditor({
  rows,
  onChange,
  copy,
}: {
  rows: AddressRow[];
  onChange: (rows: AddressRow[]) => void;
  copy: RecordFormCopy;
}) {
  const set = (i: number, patch: Partial<AddressRow>) =>
    onChange(
      rows.map((r, j) =>
        j === i
          ? { ...r, ...patch }
          : /* 勾了这一个，别的自己松开。互斥在这里做，不是留给资料库拒绝。 */
            patch.isBilling ? { ...r, isBilling: false } : r,
      ),
    );

  return (
    <div className="flex flex-col gap-3">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.addresses}
      </span>

      {rows.map((row, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]"
        >
          <div className="flex items-start gap-2">
            <input
              aria-label={copy.addrLabel}
              placeholder={copy.addrLabel}
              value={row.label}
              onChange={(e) => set(i, { label: e.target.value })}
              className={`${control} basis-[55%]`}
            />
            <input
              aria-label={copy.addrRegion}
              placeholder={copy.addrRegion}
              value={row.region}
              onChange={(e) => set(i, { region: e.target.value })}
              className={`${control} basis-[45%]`}
            />
            <button
              type="button"
              aria-label={copy.lineRemove}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="grid h-10 w-9 shrink-0 place-items-center [border-radius:var(--radius-md)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] hover:[color:var(--color-clay-bright)]"
            >
              ×
            </button>
          </div>

          <input
            aria-label={copy.addrLine}
            placeholder={copy.addrLine}
            value={row.line}
            onChange={(e) => set(i, { line: e.target.value })}
            className={control}
          />

          <label className="flex items-center gap-2 [font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
            <input
              type="checkbox"
              checked={row.isBilling}
              onChange={(e) => set(i, { isBilling: e.target.checked })}
              /* 44px 的打击面在整行上，不是在那个 16px 的方块上 ——
                 工地上戴着手套的拇指按不准一个 16px 的方块。 */
              className="h-4 w-4 shrink-0 accent-[color:var(--color-primary)]"
            />
            {copy.addrBilling}
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, blankAddress()])}
        className="inline-flex min-h-11 items-center self-start [border-radius:var(--radius-md)] border border-dashed px-3 [font-size:var(--text-sm)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)] hover:[border-color:var(--color-primary)] hover:text-[color:var(--color-on-canvas)]"
      >
        ＋ {copy.addrAdd}
      </button>
    </div>
  );
}
