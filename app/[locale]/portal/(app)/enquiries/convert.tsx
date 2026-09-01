"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 「开一张单」 — the last inch of the arrow.
 *
 * ── WHAT IT IS FOR ───────────────────────────────────────────────────────
 *
 * A stranger fills in the form on his website, the row lands here, and until
 * today the only thing he could do with it was WhatsApp them. Turning it into
 * a job meant opening another page and typing the name and the message in
 * again -- which is exactly the copying the product exists to remove.
 *
 * ── THE THREE THINGS IT IS CAREFUL ABOUT ─────────────────────────────────
 *
 * ⚠️ IT DOES NOT SAY WHAT IT DID; IT SHOWS THE ROW. The reply carries the
 * document number and a link to it, because 「已开好」 with nothing to open is
 * the shape of claim this repository has shipped eleven times. If the row
 * cannot be linked, the button does not say it worked.
 *
 * ⚠️ A SECOND PRESS IS NOT A SECOND QUOTATION. `convert_enquiry` returns the
 * row it already made and says `already`, so a double-tap on a phone -- the
 * normal case on a 4G connection where nothing has visibly happened yet --
 * lands the owner on the job rather than opening a second one.
 *
 * ⚠️ AND IT IS NOT OFFERED WHEN IT CANNOT WORK. A business whose system has no
 * pipeline page has nowhere for a quotation to go; the button is replaced by
 * the reason rather than drawn and refused.
 */
export function ConvertEnquiry({
  enquiryId,
  locale,
  /** Already converted on a previous visit -- read from the row, so the state
   *  survives a reload rather than living only in this component. */
  converted,
}: {
  enquiryId: string;
  locale: string;
  converted: { recordId: string; moduleKey: string; docNo: string } | null;
}) {
  const t = useTranslations("portal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(converted);
  const [failed, setFailed] = useState(false);

  async function convert() {
    setBusy(true);
    setFailed(false);
    const { data, error } = await createBrowserSupabaseClient().rpc("convert_enquiry", {
      in_enquiry_id: enquiryId,
    });
    const row = (data as { record_id: string; module_key: string; doc_no: string }[] | null)?.[0];
    setBusy(false);
    /* No row means nothing landed, whatever the call returned. Saying so is
       the whole of 重点 23's claim-check in one line. */
    if (error || !row?.record_id) return setFailed(true);
    setDone({ recordId: row.record_id, moduleKey: row.module_key, docNo: row.doc_no });
    /* The inbox's own count and status change too -- this row is 'done' now. */
    router.refresh();
  }

  if (done) {
    return (
      <Link
        href={`/${locale}/portal/${done.moduleKey}/${done.recordId}`}
        className="rounded-[var(--radius-md)] border px-3 py-1.5 text-xs [border-color:var(--color-jade)] [color:var(--color-jade-bright)] transition-colors hover:[background-color:var(--color-ink-850)]"
      >
        {done.docNo
          ? t("enquiryConverted", { docNo: done.docNo })
          : t("enquiryConvertedPlain")}
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {failed && (
        <span role="status" className="text-xs [color:var(--color-clay-bright)]">
          {t("enquiryConvertFailed")}
        </span>
      )}
      <button
        type="button"
        onClick={convert}
        disabled={busy}
        className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] transition-colors hover:[background-color:var(--color-primary-deep)] disabled:opacity-50"
      >
        {busy ? t("enquiryConverting") : t("enquiryConvert")}
      </button>
    </span>
  );
}
