"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

export type Guest = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
};

type Note = {
  id: string;
  done_on: string | null;
  what: string;
  area: string | null;
  note: string | null;
  staff_name: string | null;
  archived: boolean;
  products: { item?: string; qty?: number; unit?: string; batch?: string }[] | null;
};

type Consent = {
  id: string;
  form_name: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
};

type Words = Record<string, string>;

/**
 * 左边一条客人清单，右边那个客人的两段。
 *
 * 骨架抄的是 Boulevard 跟 Timely 的 client management（拼图在
 * `.screenshots/featurepages/sheet-②.jpg`）：**清单在左、那个人的几段在右**，
 * 每一段一个小标题。四家里四家都是这个。
 *
 * ⚠️ 我们只放两段，因为我们只有两段是真的：**她签了没有** ＋ **做过什么**。
 * 参考那几家右边还有联络方式 · 消费纪录 · 下一次预约 —— 那几样在别的页上，
 * 搬过来就是同一件事在两个地方讲（这个仓库砍过三次的那一类）。
 */
export function TreatmentDesk({
  guests,
  staff,
  words,
}: {
  guests: Guest[];
  staff: { id: string; name: string }[];
  words: Words;
}) {
  const [find, setFind] = useState("");
  const [who, setWho] = useState<Guest | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  const [what, setWhat] = useState("");
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const [byWho, setByWho] = useState("");

  const sb = () => createBrowserSupabaseClient();

  const shown = find.trim()
    ? guests.filter((g) => g.name.toLowerCase().includes(find.trim().toLowerCase()))
    : guests;

  async function open(g: Guest) {
    setWho(g);
    setAdding(false);
    setFailed("");
    setLoading(true);
    const s = sb();
    const [n, c] = await Promise.all([
      s.rpc("treatment_notes_of", { in_party_id: g.id }),
      s.rpc("consents_of", { in_party_id: g.id }),
    ]);
    setNotes((n.data ?? []) as Note[]);
    setConsents((c.data ?? []) as Consent[]);
    setLoading(false);
  }

  async function save() {
    if (!who || !what.trim()) {
      setFailed(words.needWhat);
      return;
    }
    setBusy(true);
    setFailed("");
    const { error } = await sb().rpc("add_treatment_note", {
      in_party_id: who.id,
      in_what: what.trim(),
      in_area: area.trim(),
      in_note: note.trim(),
      ...(byWho ? { in_staff_id: byWho } : {}),
    });
    setBusy(false);
    if (error) {
      setFailed(words.failed);
      return;
    }
    setWhat("");
    setArea("");
    setNote("");
    setByWho("");
    setAdding(false);
    await open(who);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      {/* 左：客人。 */}
      <DeskCard title={words.who}>
        <input
          type="search"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder={words.find}
          className={deskField}
        />
        {shown.length === 0 ? (
          <p className={`mt-3 ${deskDim}`}>{words.noGuests}</p>
        ) : (
          <ul className="mt-2 max-h-[28rem] overflow-y-auto">
            {shown.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => void open(g)}
                  aria-current={who?.id === g.id}
                  className={`w-full [border-radius:var(--radius-md)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] text-left ${
                    who?.id === g.id
                      ? "[background-color:var(--color-primary-soft)] [font-weight:var(--fw-semibold)]"
                      : ""
                  }`}
                >
                  {g.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DeskCard>

      {/* 右：那个人的两段。 */}
      <div className="flex flex-col gap-4">
        {!who ? (
          <DeskCard title={words.notesTitle}>
            <p className={deskDim}>{words.pick}</p>
          </DeskCard>
        ) : (
          <>
            {/* 🔴 她签了没有 —— 排在**做过什么**上面。
                一个还没签的同意书是她**动手之前**要处理的一件事，
                而做过什么是回头看的（[任务 326] 那个第十四个讯号问的就是这一句）。 */}
            <DeskCard title={words.consentTitle}>
              {loading ? (
                <p className={deskDim}>…</p>
              ) : consents.length === 0 ? (
                <p className={deskDim}>{words.consentNone}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {consents.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="[font-size:var(--text-sm)]">{c.form_name}</span>
                      <span
                        className={
                          c.signed_at
                            ? "[color:var(--color-jade-bright)] [font-size:var(--text-sm)]"
                            : "[color:var(--color-brass-bright)] [font-size:var(--text-sm)]"
                        }
                      >
                        {c.signed_at ? words.signed : words.waiting}
                      </span>
                      {c.signed_at && (
                        <span className={deskDim}>{c.signed_at.slice(0, 10)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </DeskCard>

            <DeskCard title={words.notesTitle}>
              {!adding && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className={`${deskBtn("primary")} mb-3`}
                >
                  {words.add}
                </button>
              )}

              {adding && (
                <div className="mb-4 flex flex-col gap-3 [border-radius:var(--radius-md)] [border:var(--hairline)_solid_var(--input)] p-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={deskDim}>{words.what}</span>
                    <input
                      type="text"
                      value={what}
                      onChange={(e) => setWhat(e.target.value)}
                      className={deskField}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className={deskDim}>{words.area}</span>
                      <input
                        type="text"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className={deskField}
                      />
                    </label>
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className={deskDim}>{words.byWho}</span>
                      <select
                        value={byWho}
                        onChange={(e) => setByWho(e.target.value)}
                        className={deskField}
                      >
                        <option value="">{words.nobody}</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className={deskDim}>{words.note}</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className={deskField}
                    />
                  </label>
                  {failed && (
                    <p className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
                      {failed}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={busy}
                      className={deskBtn("primary")}
                    >
                      {busy ? words.saving : words.save}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setFailed("");
                      }}
                      className={deskBtn()}
                    >
                      {words.cancel}
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <p className={deskDim}>…</p>
              ) : notes.length === 0 ? (
                <p className={deskDim}>{words.noNotes}</p>
              ) : (
                <ul>
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="border-t py-3 [border-color:var(--color-ink-800)]"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="[font-size:var(--text-base)] [font-weight:var(--fw-medium)]">
                          {n.what}
                        </span>
                        {n.area && <span className={deskDim}>{n.area}</span>}
                        <span className={`ms-auto ${deskDim}`}>
                          {n.done_on ?? ""}
                          {n.staff_name ? ` · ${n.staff_name}` : ""}
                        </span>
                      </div>
                      {n.note && (
                        <p className={`mt-1 ${deskDim}`}>{n.note}</p>
                      )}
                      {/* 用掉的那几样 —— 架上真的少了这几件（`add_treatment_product`）。 */}
                      {n.products && n.products.length > 0 && (
                        <p className={`mt-1 ${deskDim}`}>
                          {words.used}
                          {": "}
                          {n.products
                            .map(
                              (p) =>
                                `${p.item ?? ""} ${p.qty ?? ""}${p.unit ? ` ${p.unit}` : ""}`.trim(),
                            )
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </DeskCard>
          </>
        )}
      </div>
    </div>
  );
}
