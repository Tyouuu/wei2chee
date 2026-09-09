"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 她要客人签的那几份表单。
 *
 * ── 🔴 内容我们一个字都不给 ───────────────────────────────────────────────
 *
 * Mangomint 自己那一篇写着：一份肉毒的同意书跟一份激光的，写的风险不一样，
 * 所以要分开做几份。而那几份的**内容我们一个字都不写** ——
 * 一份同意书上写的是风险 · 替代方案 · 禁忌，那是**医疗上的宣称**，
 * 而我们不是一间诊所（[任务 309] 判「处方不做」是同一条）。
 *
 * ── 🔴 改了措辞，已经签的那几份一个字都不会变 ─────────────────────────────
 *
 * 发出去那一刻就抄了一份快照（`request_consent`）。她今年三月改了措辞，
 * 而去年十月那个客人签的是**当时那一份** ——
 * **一份会跟着范本变的证据不是证据。**
 * 这一句要写在画面上，不是只写在注解里：她改字的时候，
 * 唯一会让她犹豫的就是「那以前签的会不会跟着变」。
 *
 * ── 关掉，不删 ────────────────────────────────────────────────────────────
 *
 * 一份签过的表单挂着它。跟房间 · 分店同一条。
 */

export type FormRow = {
  id: string;
  name: string;
  body: string;
  archived: boolean;
  signed_count: number;
  waiting_count: number;
};

type Need = "addName" | "addBody" | "editName" | "editBody" | null;

/** 那句话贴着那一格。四个框共用一份 —— 抄四份，四份会漂。 */
function Needed({ children }: { children: string }) {
  return (
    <span
      role="alert"
      className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
    >
      {children}
    </span>
  );
}

export function ConsentDesk({
  projectId,
  rows,
  copy,
}: {
  projectId: string;
  rows: readonly FormRow[];
  copy: {
    title: string;
    lede: string;
    snapshot: string;
    add: string;
    adding: string;
    name: string;
    body: string;
    save: string;
    saving: string;
    edit: string;
    cancel: string;
    off: string;
    on: string;
    needName: string;
    needBody: string;
    offLabel: string;
    none: string;
    signed: string;
    waiting: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [need, setNeed] = useState<Need>(null);
  const addNameRef = useRef<HTMLInputElement>(null);
  const addBodyRef = useRef<HTMLTextAreaElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const editBodyRef = useRef<HTMLTextAreaElement>(null);
  /* 正在改哪一份。null = 没有在改。 */
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");

  /* 🔴 **不把按钮变灰。**
     [任务 281] 立过这一条：一颗按不动又不讲为什么的按钮，比一句话糟 ——
     按下去才是她学会要填哪一格的那一刻。而那句话贴着那一格、
     讲**要什么**不讲**哪里错了**（Baymard），光标跟着回去。
     ⚠️ 一次只指第一个空的那一格 —— 两句话一起出现，她不知道先填哪一个。 */
  function missing(where: "add" | "edit") {
    const [n, b] = where === "add" ? [name, body] : [editName, editBody];
    if (!n.trim()) {
      setNeed(`${where}Name` as Need);
      (where === "add" ? addNameRef : editNameRef).current?.focus();
      return true;
    }
    if (!b.trim()) {
      setNeed(`${where}Body` as Need);
      (where === "add" ? addBodyRef : editBodyRef).current?.focus();
      return true;
    }
    setNeed(null);
    return false;
  }

  async function add() {
    if (busy || missing("add")) return;
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "add_consent_form",
        { in_project_id: projectId, in_name: name.trim(), in_body: body.trim() },
      );
      if (err) {
        setError(err.message);
        return;
      }
      setName("");
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    if (busy || missing("edit")) return;
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "update_consent_form",
        { in_id: id, in_name: editName.trim(), in_body: editBody.trim() },
      );
      if (err) {
        setError(err.message);
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: FormRow) {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "update_consent_form",
        { in_id: row.id, in_archived: !row.archived },
      );
      if (err) setError(err.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskCard title={copy.title}>
      <div className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className={deskDim}>{copy.none}</p>
        ) : (
          /* 🔴 关掉的那几份**排到底下** —— 她打开这一页问的是
             「我现在有哪几份」，而一条划掉的字混在里面，
             每一次都要她用眼睛滤一遍。跟房间 · 分店同一条。 */
          <div className="flex flex-col gap-4">
            {([false, true] as const).map((archived) => {
              const some = rows.filter((r) => r.archived === archived);
              if (some.length === 0) return null;
              return (
                <div key={String(archived)} className="flex flex-col gap-1.5">
                  {archived ? <p className={deskDim}>{copy.offLabel}</p> : null}
                  <div className="flex flex-col [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]">
                    {some.map((r, i) => (
                      <div
                        key={r.id}
                        className={
                          "flex flex-col gap-2 px-3 py-3 [font-size:var(--text-sm)] " +
                          (i ? "border-t [border-color:var(--color-ink-800)]" : "")
                        }
                      >
                        {editing === r.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              ref={editNameRef}
                              aria-label={copy.name}
                              value={editName}
                              onChange={(e) => {
                                setEditName(e.target.value);
                                if (need === "editName") setNeed(null);
                              }}
                              aria-invalid={need === "editName" || undefined}
                              className={deskField}
                            />
                            {need === "editName" ? (
                              <Needed>{copy.needName}</Needed>
                            ) : null}
                            <textarea
                              ref={editBodyRef}
                              aria-label={copy.body}
                              value={editBody}
                              onChange={(e) => {
                                setEditBody(e.target.value);
                                if (need === "editBody") setNeed(null);
                              }}
                              aria-invalid={need === "editBody" || undefined}
                              rows={8}
                              className={deskField + " h-auto py-2"}
                            />
                            {need === "editBody" ? (
                              <Needed>{copy.needBody}</Needed>
                            ) : null}
                            {/* 🔴 她改字的时候唯一会犹豫的那一句，就写在这里。 */}
                            <p className={deskDim}>{copy.snapshot}</p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void save(r.id)}
                                className={deskBtn("primary")}
                              >
                                {busy ? copy.saving : copy.save}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setEditing(null)}
                                className={deskBtn()}
                              >
                                {copy.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={
                                  archived
                                    ? "flex-1 text-[color:var(--color-on-canvas-dim)]"
                                    : "flex-1 [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]"
                                }
                              >
                                {r.name}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setEditing(r.id);
                                  setEditName(r.name);
                                  setEditBody(r.body);
                                }}
                                className="min-h-11 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline disabled:opacity-60"
                              >
                                {copy.edit}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void toggle(r)}
                                className="min-h-11 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline disabled:opacity-60"
                              >
                                {r.archived ? copy.on : copy.off}
                              </button>
                            </div>
                            {/* 🔴 零不画。一份写着「签了 0 · 在等 0」的表单，
                                是两个没有讲任何事的数字。 */}
                            {r.signed_count > 0 || r.waiting_count > 0 ? (
                              <p className={deskDim}>
                                {[
                                  r.signed_count > 0
                                    ? copy.signed.replace("{n}", String(r.signed_count))
                                    : null,
                                  r.waiting_count > 0
                                    ? copy.waiting.replace("{n}", String(r.waiting_count))
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t [border-color:var(--color-ink-800)] pt-4">
          <input
            ref={addNameRef}
            aria-label={copy.name}
            placeholder={copy.name}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (need === "addName") setNeed(null);
            }}
            aria-invalid={need === "addName" || undefined}
            className={deskField}
          />
          {need === "addName" ? <Needed>{copy.needName}</Needed> : null}
          <textarea
            ref={addBodyRef}
            aria-label={copy.body}
            placeholder={copy.body}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (need === "addBody") setNeed(null);
            }}
            aria-invalid={need === "addBody" || undefined}
            rows={6}
            className={deskField + " h-auto py-2"}
          />
          {need === "addBody" ? <Needed>{copy.needBody}</Needed> : null}
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void add()}
              className={deskBtn("primary")}
            >
              {busy ? copy.adding : copy.add}
            </button>
          </div>
          <p className={deskDim}>{copy.lede}</p>
        </div>

        {error ? (
          <p
            role="alert"
            className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </DeskCard>
  );
}
