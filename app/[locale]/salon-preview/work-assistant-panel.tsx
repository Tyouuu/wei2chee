"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Skip } from "@/lib/portal/skip-codes";
import { sayWhyNot } from "../portal/[pageKey]/ai-assistant";

/**
 * `work-assistant.tsx` 的轻量版——给新版沙龙十四页（`salon-preview/`）用，
 * 不依赖 Puck。
 *
 * ── 为什么要另一份档案，不是改那一份 ──────────────────────────────────
 *
 * `work-assistant.tsx` 的 `data: Data` 要一棵 Puck 排版树；新版十四页是真的
 * React server component，没有树。改它会把一个新的"可能没有树"分支塞进
 * 一个已经验证过、还在给旧版用的组件里——[重点31]：不整支重写，这里反过来，
 * 是"不整支混进去"。UI/交互逻辑（药丸输入框、拍照、语音、核对/撤销那一站）
 * 一个字不碰 Puck，原样复制过来；碰 Puck 的那几处（`data` prop、`latest`
 * 那棵树的来回传递）换成 `pageDescription`。
 *
 * ── 跟 `work-assistant.tsx` 行为上的两个不同 ──────────────────────────
 *
 *   ① **没有 `latest` 这个状态**。旧版那边 `data` 是一棵客户端手上的树，
 *      写完要自己接住新的那一份（见那个档案的档头：「同一件事两条路，只
 *      修了一条」）。这里 `pageDescription` 是**伺服器组件的 prop**：
 *      写完 `router.refresh()`，伺服器重新渲染整页，这个 prop 自然换成
 *      新的一份——不用自己接，Next.js 替我们接住了。
 *   ② **自己管开关**，不是外面（`system-view.tsx`）传进来的。新版侧栏
 *      （`salon-shell.tsx`）还没有旧版那种「跟内容一起收放」的外壳，
 *      先用一颗固定在右下角的按钮收合，跟旧版窄屏那一颗同一个形状。
 */
export function WorkAssistantPanel({
  pageKey,
  pageDescription,
  pages,
}: {
  pageKey: string;
  /** 这一页现在有哪几条真记录——`lib/portal/salon-work-describe.ts` 产生的
   *  那段文字，只送出去给模型看，不接回来。 */
  pageDescription: string;
  /** 他这套系统有哪几页。只用来给模型认路，什么都不授权。 */
  pages: { key: string; label: string }[];
}) {
  const t = useTranslations("portal.editor");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string[] | null>(null);
  const [turns, setTurns] = useState<{ asked: string; did: string }[]>([]);
  const [shot, setShot] = useState<{ path: string; preview: string } | null>(
    null,
  );
  const [attaching, setAttaching] = useState(false);
  const [hearing, setHearing] = useState<"off" | "rec" | "reading">("off");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function startTalking() {
    if (hearing !== "off") return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setSaid([t("aiHearNoMic")]);
      return;
    }
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const clip = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (!clip.size) {
        setHearing("off");
        return;
      }
      setHearing("reading");
      try {
        const body = new FormData();
        body.append("clip", clip, "note.webm");
        const res = await fetch("/api/portal/hear", { method: "POST", body });
        const out = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          text?: string;
        };
        if (out.ok && out.text) {
          setText((prev) => (prev.trim() ? `${prev.trim()} ${out.text}` : out.text!));
        } else {
          setSaid([t("aiHearNothing")]);
        }
      } catch {
        setSaid([t("aiHearNothing")]);
      } finally {
        setHearing("off");
      }
    };
    rec.start();
    setHearing("rec");
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, 60000);
  }

  function stopTalking() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }
  const shotRef = useRef<HTMLInputElement>(null);

  async function attach(file: File) {
    setAttaching(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: ws } = await supabase.rpc("my_workspace");
      const projectId = (ws as { project_id?: string }[] | null)?.[0]
        ?.project_id;
      if (!projectId) return;
      const ext = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .slice(0, 5);
      const path = `${projectId}/ask-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("ask-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return;
      setShot({ path, preview: URL.createObjectURL(file) });
    } finally {
      setAttaching(false);
    }
  }

  const [pending, setPending] = useState<{
    ops: unknown[];
    preview: {
      kind: string;
      head: string;
      sub: string;
      lines: { text: string; amount: string }[];
      total: string;
    }[];
  } | null>(null);
  const [undoable, setUndoable] = useState<{ kind: string; id: string; what: string }[]>([]);

  function clearShot() {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
  }

  const [today, setToday] = useState<string[] | null>(null);
  const askedToday = useRef(false);
  useEffect(() => {
    if (!open || askedToday.current) return;
    askedToday.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/portal/today");
        if (!res.ok) return;
        const out = (await res.json()) as { lines?: string[] };
        setToday(Array.isArray(out.lines) ? out.lines.filter(Boolean) : []);
      } catch {
        /* 读不到就当作没有 —— 那三句现成的照旧在。 */
      }
    })();
  }, [open]);

  async function talk(extra: Record<string, unknown>, asked: string) {
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/portal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          /* 没有 Puck 树可传——这一页根本不是 Puck 搭的。空壳只为了通过
             那一行必填检查（`!layout || !Array.isArray(layout.content)`），
             `describeLayout` 在这条路径下不会被呼叫，见 route 里的判断。 */
          layout: { content: [] },
          salonDescription: pageDescription,
          pageKey,
          pages,
          surface: "work",
          generated: false,
          ...extra,
        }),
      });
      if (res.status === 429) {
        setSaid([t("aiRateLimited")]);
        return;
      }
      if (!res.ok) {
        setSaid([t("aiBroke")]);
        return;
      }
      const out = (await res.json()) as {
        explanation?: string;
        applied?: number;
        notes?: Skip[];
        skipped?: Skip[];
        refetch?: boolean;
        pending?: {
          ops: unknown[];
          preview: {
            kind: string;
            head: string;
            sub: string;
            lines: { text: string; amount: string }[];
            total: string;
          }[];
        } | null;
        undo?: { kind: string; id: string; what: string }[];
      };
      if (out.pending && out.pending.ops.length) {
        setPending(out.pending);
        setSaid(
          [
            (out.explanation ?? "").trim(),
            ...(out.skipped ?? []).map((n) => sayWhyNot(t, n)),
          ].filter(Boolean),
        );
        return;
      }
      setPending(null);
      setUndoable(Array.isArray(out.undo) ? out.undo : []);
      const lines = [
        (out.explanation ?? "").trim() ||
          (out.applied ? t("aiWorkDone") : t("aiWorkNothing")),
        ...(out.notes ?? []).map((n) => sayWhyNot(t, n)),
        ...(out.skipped ?? []).map((n) => sayWhyNot(t, n)),
      ].filter(Boolean);
      setSaid(lines);
      const did = (out.explanation ?? "").trim();
      if (did) setTurns((prev) => [...prev, { asked, did }].slice(-3));
      setText("");
      /* 那一行在资料库里，不在这一份文字描述里——伺服器重新渲染会给
         出一份新的 `pageDescription`，不用在这里手动接住。 */
      if (out.refetch) router.refresh();
    } catch {
      setSaid([t("aiFailed")]);
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const asked = text.trim();
    if ((!asked && !shot) || busy) return;
    void talk(
      {
        instruction: asked || t("aiWorkShot"),
        imagePath: shot?.path ?? null,
        history: turns.slice(-3),
      },
      asked,
    );
  }

  function confirmPending() {
    if (!pending || busy) return;
    void talk({ confirm: pending.ops, instruction: t("aiWorkShot") }, "");
  }

  function dropPending() {
    setPending(null);
    setSaid([t("aiWorkDropped")]);
  }

  function undoLast() {
    if (!undoable.length || busy) return;
    const taking = undoable;
    setUndoable([]);
    void talk({ undo: taking }, "");
  }

  const starters = t("aiWorkPlaceholder")
    .replace(/^e\.g\.\s*/i, "")
    .split(" · ")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!open) {
    return (
      <button
        type="button"
        data-salon-ai="closed"
        aria-label={t("aiWorkOpen")}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 end-6 z-30 grid h-14 w-14 place-items-center rounded-full shadow-lg bg-[#000000] text-[#ffffff]"
      >
        <IconSpark className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section
      data-salon-ai="open"
      aria-label={t("aiWorkTitle")}
      className="fixed inset-0 z-40 flex flex-col bg-[#ffffff] border-[#c8c5cb]/40 lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[345px] lg:[border-left-width:1px]"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 [border-bottom-width:1px] border-[#c8c5cb]/40 px-4">
        <span className="flex items-center gap-2 text-[#1a1c1f] text-[13.5px] font-semibold">
          <IconSpark className="h-[18px] w-[18px] shrink-0" />
          {t("aiWorkTitle")}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("aiClose")}
          title={t("aiClose")}
          className="grid h-11 w-11 shrink-0 place-items-center text-[#5e5e67] text-[13.5px]"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3 px-4">
        {said ? (
          <div
            data-salon-ai-said
            className="flex flex-col gap-1 text-[#1a1c1f] text-[13.5px]"
          >
            {said.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : null}

        {pending ? (
          <div
            data-salon-ai-check
            className="flex flex-col gap-2 border-[#c8c5cb]/40 [border-width:1px] rounded-lg py-3 px-4"
          >
            <p className="text-[#5e5e67] text-[11px]">
              {t("aiWorkCheck")}
            </p>
            {pending.preview.map((one, i) => (
              <div key={i} className="flex flex-col gap-1">
                <p className="text-[#5e5e67] text-[11px]">
                  {one.kind === "payment"
                    ? t("aiWorkKindPayment")
                    : one.kind === "classBill"
                      ? t("aiWorkKindClassBill")
                      : one.kind === "line"
                        ? t("aiWorkKindLine")
                        : t("aiWorkKindRecord")}
                </p>
                <p className="text-[#1a1c1f] text-[13.5px]">
                  {[one.head, one.sub === one.head ? "" : one.sub].filter(Boolean).join(" · ")}
                </p>
                {one.lines.map((line, j) => (
                  <p
                    key={j}
                    className="flex justify-between gap-3 text-[#5e5e67] text-[11px]"
                  >
                    <span>{line.text}</span>
                    <span data-salon-ai-check-amount>{line.amount}</span>
                  </p>
                ))}
                {one.total ? (
                  <p className="flex justify-between gap-3 text-[#1a1c1f] text-[13.5px]">
                    <span aria-hidden>&nbsp;</span>
                    <span data-salon-ai-check-total>{one.total}</span>
                  </p>
                ) : null}
              </div>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                data-salon-ai-confirm
                onClick={confirmPending}
                disabled={busy}
                className="bg-[#000000] rounded-full text-[#ffffff] text-[13.5px] py-3 px-4 disabled:opacity-60"
              >
                {t("aiWorkConfirm")}
              </button>
              <button
                type="button"
                data-salon-ai-drop
                onClick={dropPending}
                disabled={busy}
                className="text-[#5e5e67] text-[13.5px] py-3 px-4 underline disabled:opacity-60"
              >
                {t("aiWorkNotNow")}
              </button>
            </div>
          </div>
        ) : null}

        {!pending && undoable.length ? (
          <button
            type="button"
            data-salon-ai-undo
            onClick={undoLast}
            disabled={busy}
            className="self-start text-[#5e5e67] text-[11px] underline disabled:opacity-60"
          >
            {t("aiWorkUndo")}
          </button>
        ) : null}

        {!said && !pending && today && today.length ? (
          <div data-salon-ai-today className="flex flex-col gap-1">
            <p className="text-[#5e5e67] text-[11px]">
              {t("aiWorkToday")}
            </p>
            {today.map((line, i) => (
              <p
                key={i}
                className="text-[#1a1c1f] text-[13.5px]"
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {!said && !pending ? (
          <div className="flex flex-col gap-1">
            {starters.map((one) => (
              <button
                key={one}
                type="button"
                onClick={() => setText(one)}
                className="flex rounded-lg text-[#5e5e67] text-[13.5px] py-3 px-4 text-start hover:bg-[#f3f3f7]"
              >
                {one}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-[#c8c5cb]/40 [border-top-width:1px] py-3 px-4">
        {shot ? (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.preview}
              alt=""
              className="h-10 w-14 rounded object-cover"
            />
            <button
              type="button"
              onClick={clearShot}
              className="text-[#5e5e67] text-[11px] underline"
            >
              {t("aiImageRemove")}
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-full bg-[#ffffff] border-[#c8c5cb]/60 [border-width:1px] [padding-block:7px] [padding-inline:14px]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            aria-label={t("aiWorkTitle")}
            placeholder={t("aiWorkOpen")}
            className="max-h-32 min-h-[26px] w-full resize-none border-0 bg-transparent p-0 text-[#1a1c1f] text-[13.5px] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || (!text.trim() && !shot)}
            aria-label={busy ? t("aiThinking") : t("aiSubmit")}
            title={busy ? t("aiThinking") : t("aiSubmit")}
            className="mb-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#000000] text-[#ffffff] text-[13.5px] disabled:opacity-40"
          >
            ↑
          </button>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <input
            ref={shotRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void attach(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            data-salon-ai-mic
            onClick={() => (hearing === "rec" ? stopTalking() : void startTalking())}
            disabled={hearing === "reading" || busy}
            className="text-[#5e5e67] text-[11.5px] [min-height:44px] underline disabled:opacity-60"
          >
            {hearing === "rec"
              ? t("aiHearStop")
              : hearing === "reading"
                ? t("aiHearReading")
                : t("aiHearStart")}
          </button>
          <button
            type="button"
            data-salon-ai-shot
            onClick={() => shotRef.current?.click()}
            disabled={attaching}
            className="text-[#5e5e67] text-[11.5px] [min-height:44px] underline disabled:opacity-60"
          >
            {attaching ? "…" : t("aiImageAdd")}
          </button>
        </div>
        <p className="text-[#5e5e67] text-[11px]">
          {t("aiEnterHint")}
        </p>
      </div>
    </section>
  );
}

function IconSpark({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.5 13.8 8.2 18.5 10 13.8 11.8 12 16.5 10.2 11.8 5.5 10 10.2 8.2Z" />
      <path d="M18.4 15.6 19.2 17.8 21.4 18.6 19.2 19.4 18.4 21.6 17.6 19.4 15.4 18.6 17.6 17.8Z" />
    </svg>
  );
}
