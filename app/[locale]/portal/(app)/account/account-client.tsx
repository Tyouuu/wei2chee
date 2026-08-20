"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PageBar } from "../page-bar";
import { formatDay } from "@/lib/format-date";

const input =
  "w-full rounded-[7px] border px-3 py-2 text-[13px] outline-none [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]";

const button =
  "rounded-[7px] border px-3.5 py-2 text-[12.5px] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-50 enabled:hover:[border-color:var(--color-primary)]";

export function AccountClient({
  locale,
  email,
  providers,
  hasPassword,
  createdAt,
  businessName,
  paid,
  pageCount,
}: {
  locale: string;
  email: string;
  providers: string[];
  hasPassword: boolean;
  createdAt: string | null;
  businessName: string;
  paid: boolean;
  stage: string;
  pageCount: number;
}) {
  const t = useTranslations("portal.account");
  const tShell = useTranslations("portal.shell");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; ok: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const supabase = () => createBrowserSupabaseClient();

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setMsg({ key: "pwMismatch", ok: false });
    setBusy("password");
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(null);
    setMsg({ key: error ? "pwFailed" : "pwSaved", ok: !error });
    if (!error) {
      setPassword("");
      setConfirm("");
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    // Supabase sends a confirmation to the NEW address and does not switch the
    // account over until it is clicked — which is the correct behaviour and the
    // reason the message below says "check your new inbox" rather than "done".
    const { error } = await supabase().auth.updateUser({ email: newEmail });
    setBusy(null);
    setMsg({ key: error ? "emailFailed" : "emailSent", ok: !error });
    if (!error) setNewEmail("");
  }

  /**
   * DATA EXPORT.
   *
   * This business promises that exporting your data is free. Promising it and
   * not shipping it is worse than never promising it, and this is the whole of
   * what a customer's data actually is: their pages, their layouts, their
   * business details. Built in the browser from their own authenticated reads,
   * so it needs no endpoint and can never return somebody else's rows.
   */
  async function exportData() {
    setExporting(true);
    const db = supabase();
    const [{ data: project }, { data: context }] = await Promise.all([
      db.from("projects").select("*").single(),
      db.rpc("get_my_business_context"),
    ]);
    const { data: pages } = project
      ? await db.from("project_pages").select("*").eq("project_id", project.id)
      : { data: [] };

    const payload = {
      exported_at: new Date().toISOString(),
      account: { email },
      project,
      business_context: context,
      pages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formae-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function deleteAccount() {
    setBusy("delete");
    const { error } = await supabase().rpc("delete_my_account");
    setBusy(null);
    if (error) return setMsg({ key: "deleteFailed", ok: false });
    await supabase().auth.signOut();
    router.push("/");
  }

  return (
    <>
      <PageBar title={t("title")} subtitle={email} />

      <div className="max-w-3xl px-8 py-7">
        {msg && (
          <p
            role="status"
            className={`mb-5 rounded-[7px] border px-3.5 py-2.5 text-[13px] ${
              msg.ok
                ? "[border-color:var(--color-jade)] [color:var(--color-jade-bright)]"
                : "[border-color:var(--color-clay)] [color:var(--color-clay-bright)]"
            }`}
          >
            {t(msg.key)}
          </p>
        )}

        <Section title={t("overview")}>
          <Row label={t("business")} value={businessName} />
          <Row label={t("plan")} value={paid ? tShell("planPaid") : tShell("planFree")} />
          <Row label={t("pages")} value={String(pageCount)} />
          <Row label={t("since")} value={createdAt ? formatDay(createdAt, locale) : "—"} />
          <Row
            label={t("signInMethod")}
            value={providers.includes("google") ? "Google" : t("methodEmail")}
          />
        </Section>

        {hasPassword ? (
          <Section title={t("passwordTitle")} body={t("passwordBody")}>
            <form onSubmit={changePassword} className="flex max-w-sm flex-col gap-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                placeholder={t("newPassword")}
                aria-label={t("newPassword")}
                className={input}
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                placeholder={t("confirmPassword")}
                aria-label={t("confirmPassword")}
                className={input}
              />
              <button type="submit" disabled={busy !== null} className={`${button} self-start`}>
                {busy === "password" ? t("saving") : t("changePassword")}
              </button>
            </form>
          </Section>
        ) : (
          // Someone who signed up with Google has no password to change, and a
          // form that cannot work is worse than an explanation.
          <Section title={t("passwordTitle")} body={t("passwordGoogle")} />
        )}

        <Section title={t("emailTitle")} body={t("emailBody")}>
          <form onSubmit={changeEmail} className="flex max-w-sm flex-col gap-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder={t("newEmail")}
              aria-label={t("newEmail")}
              className={input}
            />
            <button type="submit" disabled={busy !== null} className={`${button} self-start`}>
              {busy === "email" ? t("saving") : t("changeEmail")}
            </button>
          </form>
        </Section>

        <Section title={t("exportTitle")} body={t("exportBody")}>
          <button type="button" onClick={exportData} disabled={exporting} className={button}>
            {exporting ? t("exporting") : t("exportCta")}
          </button>
        </Section>

        {/* Last, and visually separated. A destructive action placed among
            ordinary settings is a destructive action somebody will hit by
            accident. */}
        <section className="mt-10 rounded-[9px] border p-5 [border-color:var(--color-clay-deep)]">
          <h2 className="[color:var(--color-clay-bright)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
            {t("deleteTitle")}
          </h2>
          <p className="mt-2 max-w-xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {t("deleteBody")}
          </p>
          <div className="mt-4 flex max-w-sm flex-col gap-3">
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={t("deletePlaceholder")}
              aria-label={t("deletePlaceholder")}
              className={input}
            />
            <button
              type="button"
              onClick={deleteAccount}
              // Typing the word is the confirmation. A dialog asking "are you
              // sure" is clicked through without reading; typing DELETE is not.
              disabled={deleteConfirm.trim().toUpperCase() !== "DELETE" || busy !== null}
              className="self-start rounded-[7px] px-3.5 py-2 text-[12.5px] [background-color:var(--color-clay-deep)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)] disabled:opacity-40"
            >
              {busy === "delete" ? t("saving") : t("deleteCta")}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t pt-6 first:mt-0 first:border-t-0 first:pt-0 [border-color:var(--color-ink-800)]">
      <h2 className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
        {title}
      </h2>
      {body && (
        <p className="mt-1.5 max-w-xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {body}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0 [border-color:var(--color-ink-850)]">
      <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{label}</span>
      <span className="[color:var(--color-paper)] [font-size:var(--text-sm)]">{value}</span>
    </div>
  );
}
