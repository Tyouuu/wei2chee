"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
import { Section } from "../section";

/**
 * 税那一页的三段。
 *
 * ── 🔴 没登记 SST 就不算税，而不是「税率 0」 ────────────────────────────
 *
 * 一张写着「SST RM 0.00」的单，是在讲一件他没有资格讲的话
 * （20260905610000）。所以「这一季收了多少」那一段在他还没登记的时候
 * **整段不画数字**，改成讲那一句。
 *
 * ── 「还差什么」是一份清单，不是一句「还没好」 ──────────────────────────
 *
 * `einvoice_readiness` 一条一条回「哪一格 · 缺什么」，而那正是他要拿去
 * 补的那份清单。一句「这张单还不能送」答不了他下一步该做什么。
 */

type Words = Record<string, string>;
type Profile = Record<string, string>;

const rm = (cents: number) => ringgit(cents) ?? "RM 0";

/** 一格。
 *
 *  🔴 **它一定要住在最外层。** 一个在 render 里面造出来的组件，每一次
 *  重画都是一个新的型别，React 会把那个 `input` 整个拆掉重建 ——
 *  症状是**他打一个字，游标就跳出框外**，而这一页有十个框。
 */
function Field({
  value,
  label,
  onChange,
  wide,
  dim,
  field,
}: {
  value: string;
  label: string;
  onChange: (v: string) => void;
  wide?: boolean;
  dim: string;
  field: string;
}) {
  return (
    <label className={`grid gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className={dim}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={field} />
    </label>
  );
}

export function TaxDesk({
  projectId,
  period,
  profile,
  sst,
  docs,
  words,
}: {
  projectId: string;
  period: { from: string; to: string };
  profile: Profile;
  sst: {
    registered: boolean;
    sstNo: string;
    taxable: number;
    tax: number;
    documents: number;
  } | null;
  docs: { id: string; label: string; rate: string }[];
  words: Words;
}) {
  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const btn =
    "inline-flex min-h-11 items-center justify-center [background-color:var(--color-ink-900)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:calc(var(--pad-control-x)*1.1)] disabled:opacity-60";
  const field =
    "min-h-11 w-full [background-color:var(--color-ink-950)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]";

  const [p, setP] = useState<Profile>(profile);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setP((x) => ({ ...x, [k]: v }));

  async function saveProfile(which: "who" | "sst") {
    if (busy) return;
    setBusy(which);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_tax_profile", {
        in_project_id: projectId,
        in_tin: p.tin,
        in_reg_no: p.reg_no,
        in_msic_code: p.msic_code,
        in_msic_name: p.msic_name,
        in_address_line: p.address_line,
        in_postcode: p.postcode,
        in_city: p.city,
        in_state: p.state,
        in_phone: p.phone,
        in_email: p.email,
        in_sst_no: p.sst_no,
        /* ⚠️ 空的日子存的是「没有」，不是今天 —— 一个凭空写上去的
           「从今天起登记」，是一件我们替他宣布的事。 */
        in_sst_from: p.sst_from || null,
        in_sst_rate: p.sst_rate === "" ? null : Number(p.sst_rate),
      });
      setSaid((s) => ({ ...s, [which]: error ? words.failed : words.saved }));
    } catch {
      setSaid((s) => ({ ...s, [which]: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Section label={words.whoLabel}>
        <p className={`mb-4 ${dim}`}>{words.whoLede}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            value={p.tin ?? ""}
            label={words.tin}
            onChange={(v) => set("tin", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.reg_no ?? ""}
            label={words.regNo}
            onChange={(v) => set("reg_no", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.msic_code ?? ""}
            label={words.msicCode}
            onChange={(v) => set("msic_code", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.msic_name ?? ""}
            label={words.msicName}
            onChange={(v) => set("msic_name", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.address_line ?? ""}
            label={words.addressLine}
            onChange={(v) => set("address_line", v)}
            wide
            dim={dim}
            field={field}
          />
          <Field
            value={p.postcode ?? ""}
            label={words.postcode}
            onChange={(v) => set("postcode", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.city ?? ""}
            label={words.city}
            onChange={(v) => set("city", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.state ?? ""}
            label={words.state}
            onChange={(v) => set("state", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.phone ?? ""}
            label={words.phone}
            onChange={(v) => set("phone", v)}
            dim={dim}
            field={field}
          />
          <Field
            value={p.email ?? ""}
            label={words.email}
            onChange={(v) => set("email", v)}
            dim={dim}
            field={field}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy === "who"} onClick={() => saveProfile("who")} className={btn}>
            {busy === "who" ? words.saving : words.save}
          </button>
          {said.who && (
            <span aria-live="polite" className={dim}>
              {said.who}
            </span>
          )}
        </div>
      </Section>

      <Section label={words.sstLabel}>
        <p className={`mb-4 ${dim}`}>{words.sstLede}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            value={p.sst_no ?? ""}
            label={words.sstNo}
            onChange={(v) => set("sst_no", v)}
            dim={dim}
            field={field}
          />
          <label className="grid gap-1">
            <span className={dim}>{words.sstFrom}</span>
            <input
              type="date"
              value={p.sst_from ?? ""}
              onChange={(e) => set("sst_from", e.target.value)}
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="grid gap-1">
            <span className={dim}>{words.sstRate}</span>
            <input
              value={p.sst_rate ?? ""}
              inputMode="decimal"
              onChange={(e) => set("sst_rate", e.target.value.replace(/[^0-9.]/g, ""))}
              className={`${field} text-right tabular-nums`}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy === "sst"} onClick={() => saveProfile("sst")} className={btn}>
            {busy === "sst" ? words.saving : words.save}
          </button>
          {said.sst && (
            <span aria-live="polite" className={dim}>
              {said.sst}
            </span>
          )}
        </div>

        {/* 🔴 还没登记就不画那几个数字 —— 见档头。 */}
        {sst && !sst.registered ? (
          <p className={`mt-6 ${dim}`}>{words.notRegistered}</p>
        ) : sst ? (
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t pt-5 [border-color:var(--color-ink-800)]">
            <div>
              <div className={dim}>{words.taxCollected}</div>
              <div className="mt-0.5 tabular-nums [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)]">
                {rm(sst.tax)}
              </div>
            </div>
            <div>
              <div className={dim}>{words.taxable}</div>
              <div className="mt-0.5 tabular-nums [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {rm(sst.taxable)}
              </div>
            </div>
            <div>
              <div className={dim}>{words.documents}</div>
              <div className="mt-0.5 tabular-nums [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {sst.documents}
              </div>
            </div>
            <div className="w-full">
              <p className={dim}>
                {words.thisPeriod} {period.from} — {period.to}
              </p>
            </div>
          </div>
        ) : null}
      </Section>

      <DocCheck docs={docs} words={words} dim={dim} btn={btn} field={field} />
    </>
  );
}

/** 拿一张单试一次：还差什么，跟这一张单的税率。 */
function DocCheck({
  docs,
  words,
  dim,
  btn,
  field,
}: {
  docs: { id: string; label: string; rate: string }[];
  words: Words;
  dim: string;
  btn: string;
  field: string;
}) {
  const [id, setId] = useState(docs[0]?.id ?? "");
  const [rate, setRate] = useState(docs[0]?.rate ?? "");
  const [missing, setMissing] = useState<{ what: string; missing: string }[] | null>(null);
  const [sheet, setSheet] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");

  /** 那一份单据。⚠️ 不印原始的机器格式 —— 一个装修承包商读不了它，
   *  而读不了的东西证明不了「这一份齐了」。印的是他认得的那几行。 */
  async function look() {
    if (!id || busy) return;
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("einvoice_payload", { in_record_id: id });
      if (error) {
        setSaid(words.failed);
        return;
      }
      setSheet(data as Payload);
    } catch {
      setSaid(words.failed);
    } finally {
      setBusy(false);
    }
  }

  async function check(forId = id) {
    if (!forId || busy) return;
    setBusy(true);
    setSaid("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("einvoice_readiness", { in_record_id: forId });
      if (error) {
        setSaid(words.failed);
        return;
      }
      setMissing((data ?? []) as { what: string; missing: string }[]);
    } catch {
      setSaid(words.failed);
    } finally {
      setBusy(false);
    }
  }

  async function applyRate(clear: boolean) {
    if (!id || busy) return;
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_record_tax", {
        in_record_id: id,
        in_rate: clear ? null : rate === "" ? null : Number(rate),
        in_clear: clear,
      });
      if (error) {
        setSaid(words.failed);
        return;
      }
      if (clear) setRate("");
      setSaid(words.saved);
      /* 改完税率再问一次「还差什么」—— 那一份清单里就有税率这一条，
         不重问的话它会停在上一次的答案上。 */
      await check();
    } catch {
      setSaid(words.failed);
    } finally {
      setBusy(false);
    }
  }

  if (docs.length === 0) {
    return (
      <Section label={words.checkLabel}>
        <p className={dim}>{words.noDocs}</p>
      </Section>
    );
  }

  return (
    <Section label={words.checkLabel}>
      <p className={`mb-4 ${dim}`}>{words.checkLede}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-[16rem] flex-1 gap-1">
          <span className={dim}>{words.pickDoc}</span>
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setRate(docs.find((d) => d.id === e.target.value)?.rate ?? "");
              setMissing(null);
              /* 换了一张单，上一张的答案就不再是答案。 */
              setSheet(null);
            }}
            className={field}
          >
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid w-28 gap-1">
          <span className={dim}>{words.rateOnDoc}</span>
          <input
            value={rate}
            inputMode="decimal"
            onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))}
            className={`${field} text-right tabular-nums`}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => applyRate(false)} className={btn}>
          {words.applyRate}
        </button>
        <button type="button" disabled={busy} onClick={() => applyRate(true)} className={btn}>
          {words.clearRate}
        </button>
        <button type="button" disabled={busy} onClick={() => check()} className={btn}>
          {busy ? words.checking : words.check}
        </button>
        {said && (
          <span aria-live="polite" className={dim}>
            {said}
          </span>
        )}
      </div>

      {missing !== null && (
        <div className="mt-5">
          {missing.length === 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <p className="[font-size:var(--text-base)]">{words.ready}</p>
                <button type="button" disabled={busy} onClick={look} className={btn}>
                  {words.lookAtIt}
                </button>
              </div>
              {sheet && <Sheet sheet={sheet} words={words} dim={dim} />}
            </>
          ) : (
            <>
              <p className={`mb-3 [font-size:var(--text-base)]`}>{words.stillMissing}</p>
              <ul className="flex flex-col">
                {missing.map((m, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap gap-x-4 gap-y-1 border-t py-2 [border-color:var(--color-ink-800)]"
                  >
                    <span className="[font-weight:var(--fw-medium)]">{m.what}</span>
                    <span className={dim}>{m.missing}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* 🔴 讲清楚它还不是什么 —— 见页面档头。一份看起来完整的东西，
          会让他以为已经报过税了。 */}
      <p className={`mt-6 ${dim}`}>{words.notSent}</p>
    </Section>
  );
}

type Payload = {
  supplier?: { name?: string; tin?: string; sstNumber?: string | null };
  buyer?: { name?: string; tin?: string | null } | null;
  lines?: unknown[];
  totals?: { netCents?: number; taxCents?: number; grossCents?: number; taxRate?: number | null };
  notReadyBecause?: Record<string, string>;
};

/** 那一份单据，印成他读得懂的几行。
 *
 *  🔴 「还不能送」那两句**从单据自己身上读**，不在这里再写一次 ——
 *  第二份手写的句子，是这个仓库栽过八次的那件事。 */
function Sheet({ sheet, words, dim }: { sheet: Payload; words: Words; dim: string }) {
  const t = sheet.totals ?? {};
  const row = "flex flex-wrap gap-x-4 gap-y-1 border-t py-2 [border-color:var(--color-ink-800)]";
  return (
    <div className="mt-4">
      <div className={row}>
        <span className="[font-weight:var(--fw-medium)]">{words.supplier}</span>
        <span>{sheet.supplier?.name}</span>
        <span className={dim}>{sheet.supplier?.tin}</span>
      </div>
      <div className={row}>
        <span className="[font-weight:var(--fw-medium)]">{words.buyer}</span>
        <span>{sheet.buyer?.name ?? "—"}</span>
        <span className={dim}>{sheet.buyer?.tin ?? ""}</span>
      </div>
      <div className={row}>
        <span className="[font-weight:var(--fw-medium)]">{words.lineCount}</span>
        <span className="tabular-nums">{(sheet.lines ?? []).length}</span>
      </div>
      <div className={row}>
        <span className="[font-weight:var(--fw-medium)]">{words.grossTotal}</span>
        <span className="tabular-nums">{rm(Number(t.grossCents ?? 0))}</span>
        <span className={`tabular-nums ${dim}`}>
          {words.taxCollected} {rm(Number(t.taxCents ?? 0))}
        </span>
      </div>
      {Object.values(sheet.notReadyBecause ?? {}).map((v, i) => (
        <p key={i} className={`mt-2 ${dim}`}>
          {v}
        </p>
      ))}
    </div>
  );
}
