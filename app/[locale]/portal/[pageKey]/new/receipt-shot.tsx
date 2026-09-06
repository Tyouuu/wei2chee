"use client";

import { useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ReceiptDraft } from "@/lib/portal/receipt-read";
import type { RecordFormCopy } from "../record-copy";

/**
 * 拍一张收据，上面那几格自己填好。
 *
 * ── 为什么是这一件，而且是第一件 ──────────────────────────────────────────
 *
 * `/api/receipt` 从 20260905010000 起就通了 —— 读得出金额 · 日期 · 哪一家 ·
 * 哪一类，`npm run check:receipt` 26 条真的模型呼叫全过。
 * **而画面上这颗按钮到今天为止不存在**，所以整条线一个人都用不到。
 *
 * 而它不是我们想出来的一件事：2026-09-02 拍的 16 家老板端 app 里，
 * **Xero「create a draft bill from a photo」· QuickBooks「Receipts in a snap,
 * not a pile」· Zoho「From receipt to expense in a jiffy」—— 三家最大的记帐
 * 软件全部把它放在前两屏**。那不是加分项，是这一类产品的门面。
 *
 * ── 🔴 它填，它不存 ───────────────────────────────────────────────────────
 *
 * 读完之后只是把那几格填上，**按保存的还是他**（route 自己的档头写着同一条：
 * 这本帐会拿去报税，而一个没有人读过的数字进了帐，是他月底才发现的错）。
 * 所以这里没有任何一句 `add_ledger_entry` —— 那一支归那张表单。
 *
 * ── 不逼他开相机 ──────────────────────────────────────────────────────────
 *
 * 工地照那一支写死 `capture="environment"`，理由是**按下去的是站在工地上的
 * 师傅**。这一颗不一样：按它的是老板，而他多半是**月底坐下来处理一叠收据**，
 * 那一叠已经在他相簿里、或者是供应商传给他的图。
 * ⚠️ 所以这里不给 `capture` —— 手机自己会问「拍照还是从相簿挑」，
 * 而写死它等於把「从相簿挑」那条路关掉。
 *
 * ── 🔴 每一步都要讲话 ─────────────────────────────────────────────────────
 *
 * 传 ＋ 读，一张干净的单量出来 3.0 秒，而他手上那张是皱的、歪的、灯光不均，
 * route 自己留了 120 秒的上限。**一颗按下去八秒没有反应的按钮，
 * 跟一颗坏掉的按钮在他眼里是同一颗**（走查 2026-09-07 报的第一件就是这个）。
 * 所以两段分开讲：在传 → 在读。
 */

/** 最长边。收据上的小字比风景照更需要解析度 —— route 那边送上去之前
 *  还会再缩到 1600，所以这里不能比它小。 */
const MAX_EDGE = 1600;
/** 桶自己的上限是 8MB。在这里先讲，比让储存层回一句英文好。 */
const MAX_BYTES = 7_000_000;

/** 桶只收图（20260905010000 明写不收 PDF：模型这一端还没有喂 PDF 的路，
 *  而一个收得进去、读不出来的档案比不收更糟）。 */
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

async function shrink(file: File): Promise<{ blob: Blob; ext: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", 0.85),
    );
    if (blob && blob.size < file.size) return { blob, ext: "webp" };
  } catch {
    /* HEIC · 坏掉的 EXIF · 老浏览器。传原图 —— 一张传不上去的收据，
       比一张大一点的收据糟得多。 */
  }
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/avif"
          ? "avif"
          : "jpg";
  return { blob: file, ext };
}

/** 一台相机。
 *
 * ⚠️ **画出来的，不是一个 emoji。** 第一版写 `📷`，而实拍那一张图上它是
 * 一个空方框 —— 那台机器上没有那个字形，而他客人的手机上有没有，
 * 我们决定不了。同一条这个仓库 2026-09-03 在手机那几套上付过一次学费
 * （[任务 107v] 把三十处彩色 emoji 换成单色图标）。
 *
 * ⚠️ 而它画在这里，**不用 `shell-icons`** —— 那一套是 Formae 自己那条侧栏的
 * 图标，它的档头写着「两套不可以互相漂移：一个外壳跟它做出来的东西
 * 分不出来的产品，没有自己的身份」。这一颗长在**客户的系统页**上。
 * 20 的画布 · 1.7 的笔画 · currentColor，跟那一套同一个规矩。 */
function IconCamera() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px] shrink-0"
      aria-hidden="true"
    >
      <path d="M3 7.5h2.6l1.2-2h6.4l1.2 2H17a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
      <circle cx="10" cy="11.6" r="3" />
    </svg>
  );
}

type Stage = "idle" | "uploading" | "reading" | "read";

export function ReceiptShot({
  projectId,
  copy,
  onShot,
}: {
  projectId: string;
  copy: RecordFormCopy;
  /**
   * 🔴 `draft` 可能是 null —— 传上去了、读不出来。
   * 那时候**那张照片照旧要挂在这一笔上**：他自己填那几格，
   * 而收据本身是他明年查帐要拿出来的那一张。
   */
  onShot: (path: string, draft: ReceiptDraft | null) => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [troubles, setTroubles] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function take(file: File) {
    setError(null);
    setTroubles([]);
    if (file.type && !OK_TYPES.includes(file.type)) {
      setError(copy.receiptOnlyImages);
      return;
    }
    setStage("uploading");
    try {
      const { blob, ext } = await shrink(file);
      if (blob.size > MAX_BYTES) {
        setError(copy.receiptTooBig);
        setStage("idle");
        return;
      }
      /* 路径是 `<project_id>/<uuid>.<ext>` —— 第一段就是那一家，
         而桶的政策问的正是那一段（`sees_money`）。
         ⚠️ **不带单据 id**：他是先拍照、再开单，存进去的那一刻
         那一笔开销还不存在（20260905010000 的原话）。 */
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createBrowserSupabaseClient();
      const { error: upErr } = await supabase.storage
        .from("receipts")
        .upload(path, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) {
        setError(upErr.message);
        setStage("idle");
        return;
      }

      setStage("reading");
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
        draft?: ReceiptDraft;
        troubleLines?: string[];
      };

      if (!res.ok || !body.ok || !body.draft) {
        /* 🔴 那张照片照旧挂上去 —— 见 onShot 那一段。 */
        onShot(path, null);
        setStage("read");
        setError(
          body.reason === "too-many"
            ? copy.receiptTooMany
            : /* ⚠️ 讲清楚是**我们**倒了，不是他的照片不好。一句「换一张再试」
                 会让他去重拍一张本来没问题的收据（route 档头同一条）。 */
              copy.receiptFailed,
        );
        return;
      }

      onShot(path, body.draft);
      /* 那几句是资料库那一层写好的，已经是他系统的语言。**只印，不判。** */
      setTroubles(body.troubleLines ?? []);
      setStage("read");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("idle");
    }
  }

  const busy = stage === "uploading" || stage === "reading";

  return (
    <section
      data-receipt-shot
      className="flex flex-col gap-2 [border-radius:var(--radius-md)] border [border-color:var(--input)] [padding:var(--pad-card)]"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="[font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
          {copy.receiptHeading}
        </h3>
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.receiptLede}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* ⚠️ `label` 包着一个藏起来的 input —— 一颗 `<button>` 点不开档案选择器，
            而这是这个仓库其余上传处用的同一个做法。 */}
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 [border-radius:var(--radius-md)] border px-3 py-2 [font-size:var(--text-sm)] [border-color:var(--input)] ${
            busy ? "opacity-60" : "hover:[border-color:var(--color-primary)]"
          }`}
        >
          <IconCamera />
          {stage === "uploading"
            ? copy.receiptUploading
            : stage === "reading"
              ? copy.receiptReading
              : stage === "read"
                ? copy.receiptAgain
                : copy.receiptPick}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void take(f);
            }}
          />
        </label>
        {busy ? (
          <span
            aria-live="polite"
            className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"
          >
            {stage === "uploading" ? copy.receiptUploading : copy.receiptReading}
          </span>
        ) : null}
      </div>

      {stage === "read" && !error ? (
        <p
          aria-live="polite"
          className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"
        >
          {copy.receiptDone}
        </p>
      ) : null}

      {/* 🔴 我们丢掉了什么，为什么。**空阵列不等於读得完美** ——
          而讲出来的那几句是资料库写的，画面这边一个字都不改写。 */}
      {troubles.length ? (
        <ul className="flex flex-col gap-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {troubles.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
