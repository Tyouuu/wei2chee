"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deskBtn, deskField } from "../desk-kit";

/**
 * 柜台上打一个车牌，看到这台车的上一次。
 *
 * ── 为什么这一段是 client 的（2026-09-05）─────────────────────────────────
 *
 * 这一页其余全部是伺服器画的（跟 `owing` 那一页一样）。而这一段不是：
 * **它是一个人站在柜台前面打字**，而车牌是他手上唯一的线索 ——
 * 一个每打一次就整页重载的搜索框，在柜台上是用不了的。
 *
 * ── 🔴 三个判断 ─────────────────────────────────────────────────────────
 *
 * ① **车牌洗过再比，而画面上印他打的那一串。**
 *    `find_vehicle` 自己洗（`upper` ＋ 去掉非字母数字），所以
 *    「wa 1234 a」「WA1234A」「WA-1234-A」是同一台。
 *    ⚠️ 而印出来的是 `plate` 那一栏 —— **他当时打的那串字**，
 *    因为那是印在单上的东西。
 *
 * ② **查不到不是错误。** 一台第一次进厂的车本来就不在里面 ——
 *    那时候要讲的是「还没有这个车牌」，不是一句资料库的话。
 *
 * ③ 🔴 **查不到的时候，就在那里登记。**
 *
 *    我第一版写的是「不给新增那颗按钮，车是在开单的时候连上去的」——
 *    **读了 `set_record_vehicle` 才知道那句话是错的**：它要一个
 *    **已经存在**的 `vehicle_id`，`car.id is null` 直接抛。
 *    所以 `add_vehicle` 非有一个画面不可，而**这一页就是那本册子**。
 *
 *    而它长在「查不到」底下，不是长成第二个区段 ——
 *    **那才是柜台真正的动作**：打一个车牌 -> 没有 -> 就是新客人 -> 登记。
 */

type Found = {
  vehicle_id: string;
  plate: string;
  descr: string;
  made_year: number | null;
  party_id: string | null;
  owner_name: string;
  owner_whatsapp: string;
  last_seen: string | null;
  last_odometer_km: number | null;
  visits: number;
  service_every_km: number | null;
  due_at_km: number | null;
};

type Visit = {
  record_id: string;
  doc_no: string;
  title: string;
  stage: string;
  issued_on: string | null;
  odometer_km: number | null;
  amount_cents: number | null;
  did: string;
};

export function PlateSearch({
  projectId,
  locale,
  parties,
  words,
}: {
  projectId: string;
  locale: string;
  /** 他自己的客户，给车主那一格挑。**空的时候整格不画** ——
   *  一个还没有客户的生意，那一格是一个选不了东西的下拉。 */
  parties: { id: string; name: string }[];
  words: {
    label: string;
    placeholder: string;
    search: string;
    searching: string;
    none: string;
    owner: string;
    lastSeen: string;
    lastKm: string;
    visits: string;
    dueAt: string;
    history: string;
    noHistory: string;
    failed: string;
    km: string;
    register: string;
    registering: string;
    what: string;
    whatPlaceholder: string;
    everyKm: string;
    everyKmHint: string;
    noOwner: string;
    registered: string;
    edit: string;
    editCancel: string;
    save: string;
    saving: string;
    saved: string;
    archive: string;
  };
}) {
  const [plate, setPlate] = useState("");
  const [state, setState] = useState<"idle" | "looking" | "none" | "failed">("idle");
  const [found, setFound] = useState<Found | null>(null);
  /* 改这一台。⚠️ **默认收起来** —— 柜台上打开这一页是要**查**一台车，
     不是要改它；一进来就摊开五个框，会把那个大车牌挤出第一屏。 */
  const [editing, setEditing] = useState(false);
  const [editDescr, setEditDescr] = useState("");
  const [editEvery, setEditEvery] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editSaid, setEditSaid] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [descr, setDescr] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [everyKm, setEveryKm] = useState("");
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const typed = plate.trim();
    if (!typed) return;
    setState("looking");
    setFound(null);
    setVisits([]);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("find_vehicle", {
        in_project_id: projectId,
        in_plate: typed,
      });
      if (error) {
        setState("failed");
        return;
      }
      const hit = (data as Found[] | null)?.[0];
      if (!hit) {
        setState("none");
        /* 登记那几格要清空 —— 上一台车填过的东西留在这里，
           就是下一台车带着别人的资料出生。 */
        setDescr("");
        setOwnerId("");
        setEveryKm("");
        setSaid("");
        return;
      }
      setFound(hit);
      setState("idle");
      setSaid("");
      const { data: hist } = await supabase.rpc("vehicle_history", {
        in_vehicle_id: hit.vehicle_id,
      });
      setVisits((hist as Visit[] | null) ?? []);
    } catch {
      setState("failed");
    }
  }

  async function onRegister() {
    const typed = plate.trim();
    if (!typed || saving) return;
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("add_vehicle", {
        in_project_id: projectId,
        in_plate: typed,
        in_party_id: ownerId || null,
        in_descr: descr.trim(),
        /* 🔴 空的就是 null，**不是 0** —— 一个写下来的 0 公里保养间隔
           是我们替他做的一个决定，而那一栏自己的注解写着
           「空的时候我们不猜」。 */
        in_service_every_km: everyKm ? Number(everyKm) : null,
        in_idempotency_key: crypto.randomUUID(),
      });
      if (error) {
        setSaid(words.failed);
        return;
      }
      setSaid(words.registered);
      /* 登记完就把它查出来 —— 不然他要再打一次同一个车牌，
         而那正好是这一整件事在省的东西。 */
      const { data } = await supabase.rpc("find_vehicle", {
        in_project_id: projectId,
        in_plate: typed,
      });
      const hit = (data as Found[] | null)?.[0];
      if (hit) {
        setFound(hit);
        setVisits([]);
        setState("idle");
      }
    } catch {
      setSaid(words.failed);
    } finally {
      setSaving(false);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  async function saveEdit() {
    if (!found || editBusy) return;
    setEditBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("update_vehicle", {
        in_vehicle_id: found.vehicle_id,
        in_descr: editDescr.trim(),
        /* 🔴 空的间隔要**清掉**，不是留着旧的 ——
           `in_service_every_km` 的 null 意思是「这一格不动」，
           而他把那一格清空意思是「以后不管里程」。
           两件事，而那支函式自己给了第二个参数。 */
        in_service_every_km: editEvery ? Number(editEvery) : null,
        in_clear_service_every_km: editEvery === "",
      });
      if (error) {
        setEditSaid(words.failed);
        return;
      }
      setFound({
        ...found,
        descr: editDescr.trim(),
        service_every_km: editEvery ? Number(editEvery) : null,
      });
      setEditSaid(words.saved);
      setEditing(false);
    } catch {
      setEditSaid(words.failed);
    } finally {
      setEditBusy(false);
    }
  }

  async function archive() {
    if (!found || editBusy) return;
    setEditBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_vehicle_archived", {
        in_vehicle_id: found.vehicle_id,
        in_archived: true,
      });
      if (error) {
        setEditSaid(words.failed);
        return;
      }
      /* 收起来之后这一页就没有它了 ——
         而它做过的那几张单一张都没有动。 */
      setFound(null);
      setEditing(false);
    } catch {
      setEditSaid(words.failed);
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[13rem] flex-1">
          <label htmlFor="plate" className={`mb-1.5 block ${dim}`}>
            {words.label}
          </label>
          <input
            id="plate"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder={words.placeholder}
            autoComplete="off"
            /* 车牌是大写的。**只改看到的，不改他打的** ——
               送出去的还是他那一串，而那一支自己会洗。 */
            className="min-h-11 w-full uppercase tabular-nums [background-color:var(--color-ink-950)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-base)] [letter-spacing:0.06em] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] focus-visible:[border-color:var(--color-primary)] focus-visible:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={state === "looking" || !plate.trim()}
          className="inline-flex min-h-11 items-center justify-center disabled:opacity-60 [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)]"
        >
          {state === "looking" ? words.searching : words.search}
        </button>
      </form>

      {state === "none" && (
        <div className="flex flex-col gap-4">
          <p aria-live="polite" className={dim}>
            {words.none}
          </p>
          {/* 🔴 登记就在这里，不是另一个区段 —— 见档头 3。
              那个车牌**已经在框里**，他不用再打一次（重点 29）。 */}
          <div className="grid gap-3 @xl:grid-cols-2">
            <Field label={words.what}>
              <input
                value={descr}
                onChange={(e) => setDescr(e.target.value)}
                placeholder={words.whatPlaceholder}
                className={FIELD}
              />
            </Field>
            {parties.length > 0 && (
              <Field label={words.owner}>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className={FIELD}
                >
                  <option value="">{words.noOwner}</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={words.everyKm} hint={words.everyKmHint}>
              <input
                value={everyKm}
                onChange={(e) => setEveryKm(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className={FIELD}
              />
            </Field>
          </div>
          <div>
            <button
              type="button"
              disabled={saving}
              onClick={onRegister}
              className="inline-flex min-h-11 items-center justify-center disabled:opacity-60 [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)]"
            >
              {saving ? words.registering : words.register}
            </button>
          </div>
        </div>
      )}

      {said && (
        <p aria-live="polite" className={dim}>
          {said}
        </p>
      )}
      {state === "failed" && (
        <p aria-live="polite" className={dim}>
          {words.failed}
        </p>
      )}

      {found && (
        <div className="flex flex-col gap-5">
          <div>
            {/* 车牌用大字 —— 这一页的答案就是这一台车。 */}
            <div className="[font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums [letter-spacing:0.04em]">
              {found.plate}
            </div>
            {(found.descr || found.made_year) && (
              <div className={`mt-0.5 ${dim}`}>
                {[found.descr, found.made_year].filter(Boolean).join(" · ")}
              </div>
            )}
            {/* 改这一台 · 收起来。⚙️ 这两颗只在**找到一台车**之后画。 */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className={SMALL_BTN}
              >
                {editing ? words.editCancel : words.edit}
              </button>
              {editSaid && (
                <span aria-live="polite" className={dim}>
                  {editSaid}
                </span>
              )}
            </div>
            {editing && (
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_10rem_auto_auto] md:items-end">
                <label className="grid gap-1">
                  <span className={dim}>{words.what}</span>
                  <input
                    value={editDescr}
                    onChange={(e) => setEditDescr(e.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={dim}>{words.everyKm}</span>
                  <input
                    value={editEvery}
                    inputMode="numeric"
                    onChange={(e) => setEditEvery(e.target.value.replace(/[^0-9]/g, ""))}
                    className={`${FIELD} text-right tabular-nums`}
                  />
                </label>
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={saveEdit}
                  className={SMALL_BTN}
                >
                  {editBusy ? words.saving : words.save}
                </button>
                {/* ⚠️ 收起来不是删掉 —— 它做过的那几张单还在书上。 */}
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={archive}
                  className={SMALL_BTN}
                >
                  {words.archive}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {/* 车主。**没有就整格不画** —— 一台散客的车本来就不在名册上，
                而一格写着「—」的车主读起来像资料掉了。 */}
            {found.owner_name && (
              <Fact label={words.owner}>
                {found.party_id ? (
                  <a href={`/${locale}/portal/customers/${found.party_id}`} className="underline">
                    {found.owner_name}
                  </a>
                ) : (
                  found.owner_name
                )}
                {found.owner_whatsapp && (
                  <>
                    {" · "}
                    <a
                      href={`https://wa.me/${found.owner_whatsapp.replace(/[^\d]/g, "")}`}
                      className="underline"
                    >
                      {found.owner_whatsapp}
                    </a>
                  </>
                )}
              </Fact>
            )}
            {found.last_seen && <Fact label={words.lastSeen}>{found.last_seen}</Fact>}
            {found.last_odometer_km != null && (
              <Fact label={words.lastKm}>
                {found.last_odometer_km.toLocaleString()} {words.km}
              </Fact>
            )}
            <Fact label={words.visits}>{found.visits}</Fact>
            {/* 🔴 「下次该来的里程」只有在他自己写过保养间隔的时候才画 ——
                我们不猜一个 10,000 km。那是他的决定，不是我们的。 */}
            {found.due_at_km != null && (
              <Fact label={words.dueAt}>
                {found.due_at_km.toLocaleString()} {words.km}
              </Fact>
            )}
          </div>

          <div>
            <p className={`mb-2 ${dim}`}>{words.history}</p>
            {visits.length === 0 ? (
              <p className={dim}>{words.noHistory}</p>
            ) : (
              <ul className="flex flex-col">
                {visits.map((v) => (
                  <li
                    key={v.record_id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t py-2 [border-color:var(--color-ink-800)] [font-size:var(--text-sm)]"
                  >
                    <a
                      href={`/${locale}/portal/${v.did}/${v.record_id}`}
                      className="tabular-nums underline"
                    >
                      {v.doc_no}
                    </a>
                    <span className="min-w-0 flex-1">{v.title}</span>
                    {v.odometer_km != null && (
                      <span className={`tabular-nums ${dim}`}>
                        {v.odometer_km.toLocaleString()} {words.km}
                      </span>
                    )}
                    {v.issued_on && <span className={`tabular-nums ${dim}`}>{v.issued_on}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SMALL_BTN = deskBtn();

const FIELD = deskField;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block [font-size:var(--text-micro)] text-[color:var(--color-on-canvas-dim)]">
          {hint}
        </span>
      )}
    </label>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {label}
      </div>
      <div className="mt-0.5 [font-size:var(--text-base)]">{children}</div>
    </div>
  );
}
