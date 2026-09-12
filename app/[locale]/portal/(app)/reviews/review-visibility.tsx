"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deskBtn } from "../desk-kit";

/**
 * 允许给别人看，还是不再给别人看。
 *
 * ── 为什么要有一颗按钮，不是照抄照片那一页 ────────────────────────────────
 *
 * `set_review_may_show` 照 `set_photo_may_show` 的做法：`works_here` 读写，
 * 预设不给公开（[任务 371] 档头）。跟照片不同的是这里没有上传流程，
 * 一句已经留好的评价只有「要不要拿去用」这一个动作，所以是一颗按钮，
 * 不是一段表单。
 */
export function ReviewVisibility({
  id,
  mayShow,
  copy,
}: {
  id: string;
  mayShow: boolean;
  copy: {
    mayShow: string;
    mayNotShow: string;
    makePublic: string;
    makePrivate: string;
    saving: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(mayShow);

  async function toggle() {
    setBusy(true);
    const next = !shown;
    const { error } = await createBrowserSupabaseClient().rpc(
      "set_review_may_show",
      { in_id: id, in_may_show: next },
    );
    setBusy(false);
    if (!error) {
      setShown(next);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="[font-size:var(--text-sm)]"
        style={{
          color: shown ? "var(--color-jade-bright)" : "var(--color-on-canvas-dim)",
        }}
      >
        {shown ? copy.mayShow : copy.mayNotShow}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={deskBtn()}
      >
        {busy ? copy.saving : shown ? copy.makePrivate : copy.makePublic}
      </button>
    </div>
  );
}
