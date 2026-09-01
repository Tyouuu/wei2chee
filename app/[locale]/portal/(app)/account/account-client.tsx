"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PageBar } from "../page-bar";
import { Card, CardTitle, Field, FieldRow, DataRow, EmptyState, control, btn } from "../kit";
import { formatDay } from "@/lib/format-date";
import { LocaleSwitcher } from "@/components/locale-switcher";

const input =
  "w-full rounded-[var(--radius-md)] border px-3 py-2 [font-size:var(--text-sm)] outline-none [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]";

const button =
  "rounded-[var(--radius-md)] border px-3.5 py-2 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-50 enabled:hover:[border-color:var(--color-primary)]";

export function AccountClient({
  locale,
  email,
  providers,
  hasPassword,
  createdAt,
  businessName,
  paid,
  pageCount,
  isOwner,
  members,
}: {
  locale: string;
  email: string;
  providers: string[];
  hasPassword: boolean;
  /** Only an owner has people; a 师傅 opening his own account page has an
   *  empty shell project and nobody in it. */
  isOwner: boolean;
  members: Member[];
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

  async function signOut() {
    setBusy("signout");
    await supabase().auth.signOut();
    // A hard navigation rather than router.push: signing out has to clear the
    // client cache as well as the session, and a soft push leaves the previous
    // account's pages sitting in memory behind the login screen.
    window.location.href = `/${locale}/login`;
  }

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
    /*
      THE ENQUIRIES ARE THE PART WORTH TAKING.

      This export shipped with the pages and the design and without them, which
      inverts what the file is for. A layout can be rebuilt; the people who
      filled in the form on their website cannot. `site_enquiries` is also the
      only table in this product holding data about the CUSTOMER'S customers --
      names, phone numbers, what they asked for -- so an export that leaves it
      out hands somebody their wallpaper and keeps their address book.

      Read through their own session like everything else here, so RLS is what
      bounds it rather than a filter we wrote.
    */
    const [{ data: pages }, { data: enquiries }, { data: photoFiles }] = project
      ? await Promise.all([
          db.from("project_pages").select("*").eq("project_id", project.id),
          db
            .from("site_enquiries")
            .select("*")
            .eq("project_id", project.id)
            .order("created_at", { ascending: false }),
          /* Photographs live in storage, not in a row, so the JSON alone would
             let somebody walk away believing they had everything. The layouts
             quote public URLs that stop resolving the day hosting does, which
             is exactly the day this file matters. Listing them by name and URL
             is what makes them saveable -- we are not zipping binaries into a
             browser download to achieve it. */
          db.storage.from("site-photos").list(project.id, { limit: 1000 }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    const photos = (photoFiles ?? []).map((f: { name: string }) => {
      const path = `${project?.id}/${f.name}`;
      return {
        name: f.name,
        url: db.storage.from("site-photos").getPublicUrl(path).data.publicUrl,
      };
    });

    const payload = {
      exported_at: new Date().toISOString(),
      account: { email },
      project,
      business_context: context,
      pages,
      enquiries,
      photos,
      /* Named rather than silently absent. Someone reading this file to decide
         whether they have everything deserves to be told what they do not
         have, and why -- an omission a reader has to notice is not disclosure. */
      not_included: {
        page_versions:
          "Edit history. Every saved version of every page; the current one is in `pages`.",
        photo_files:
          "The image files themselves. Listed in `photos` with a URL each — download them before hosting ends.",
      },
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
            className={`mb-5 rounded-[var(--radius-md)] border px-3.5 py-2.5 [font-size:var(--text-sm)] ${
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
          {/* ⚠️ BOTH OF THESE COME FROM THE PROJECT THIS PERSON OWNS, and a
              师傅 owns an empty shell the signup trigger made for him -- so he
              was reading 「Free trial」 and 「Pages 6」 about a project he has
              never opened, one line under a business name that came from
              somewhere else entirely. Two sources on one list is a small lie
              told confidently. What is left is all about the PERSON, which is
              what this page is for. */}
          {isOwner && (
            <>
              <Row label={t("plan")} value={paid ? tShell("planPaid") : tShell("planFree")} />
              <Row label={t("pages")} value={String(pageCount)} />
            </>
          )}
          <Row label={t("since")} value={createdAt ? formatDay(createdAt, locale) : "—"} />
          <Row
            label={t("signInMethod")}
            value={providers.includes("google") ? "Google" : t("methodEmail")}
          />
        </Section>

        {isOwner && <TeamPanel initial={members} />}

        {hasPassword ? (
          <Section title={t("passwordTitle")} body={t("passwordBody")}>
            {/* 🔴 标签从 placeholder 变成看得见的字。
                改之前两个框长得一模一样，标签就是框里那句灰字 —— **打了第一个字
                就不见了**。一个人改到一半被客人打断，回来看到两个空框，
                分不出哪个是新密码、哪个是再打一次。
                并排也是抄来的（tabler 的 `row g-3`）：两个短栏位不该各占一整行。 */}
            <form onSubmit={changePassword} className="flex flex-col gap-4">
              <FieldRow>
                <Field label={t("newPassword")} htmlFor="new-password">
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className={control}
                  />
                </Field>
                <Field label={t("confirmPassword")} htmlFor="confirm-password">
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className={control}
                  />
                </Field>
              </FieldRow>
              <button type="submit" disabled={busy !== null} className={`${btn("quiet")} self-start`}>
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
          <form onSubmit={changeEmail} className="flex max-w-md flex-col gap-4">
            <Field label={t("newEmail")} htmlFor="new-email">
              <input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoComplete="email"
                className={control}
              />
            </Field>
            <button type="submit" disabled={busy !== null} className={`${btn("quiet")} self-start`}>
              {busy === "email" ? t("saving") : t("changeEmail")}
            </button>
          </form>
        </Section>

        <Section title={t("exportTitle")} body={t("exportBody")}>
          <button type="button" onClick={exportData} disabled={exporting} className={btn("quiet")}>
            {exporting ? t("exporting") : t("exportCta")}
          </button>
        </Section>

        {/* LANGUAGE AND SIGN OUT LIVE HERE NOW.
            They used to be two naked controls in the bottom corner of the
            navigation rail — a switcher and an underlined link, lying loose
            under the last nav item with nothing around them. On the one screen
            where a Malaysian SME owner is deciding whether there is a company
            behind the URL, that reads as a weekend build.

            Every product of this shape puts them behind the account row, so
            the rail now carries one account block that leads here, and these
            are rows in a settings page like everything else. */}
        <Section title={t("languageTitle")} body={t("languageBody")}>
          <LocaleSwitcher />
        </Section>

        <Section title={t("signOutTitle")} body={t("signOutBody")}>
          <button type="button" onClick={signOut} disabled={busy !== null} className={btn("quiet")}>
            {busy === "signout" ? t("saving") : t("signOutCta")}
          </button>
        </Section>

        {/* Last, and visually separated. A destructive action placed among
            ordinary settings is a destructive action somebody will hit by
            accident. */}
        <section className="mt-10 rounded-[var(--radius-md)] border p-5 [border-color:var(--color-clay-deep)]">
          <h2 className="[color:var(--color-clay-bright)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
            {t("deleteTitle")}
          </h2>
          <p className="mt-2 max-w-xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {t("deleteBody")}
          </p>
          <div className="mt-4 flex max-w-sm flex-col gap-3">
            <Field label={t("deletePlaceholder")} htmlFor="delete-confirm">
              <input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className={control}
              />
            </Field>
            <button
              type="button"
              onClick={deleteAccount}
              // Typing the word is the confirmation. A dialog asking "are you
              // sure" is clicked through without reading; typing DELETE is not.
              disabled={deleteConfirm.trim().toUpperCase() !== "DELETE" || busy !== null}
              className={`${btn("danger")} self-start [background-color:var(--color-clay-deep)] [border-color:var(--color-clay-deep)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]`}
            >
              {busy === "delete" ? t("saving") : t("deleteCta")}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

/* 🔴 一段 = 一张卡，2026-09-01。
   改之前这一页是**八段裸表单**，靠一条细线分开，标题、说明、输入框全部一样重，
   整页唯一被设计过的东西是最底下那个红框。
   tabler（MIT · 41.5k★）的设定页读下来是：**一张卡装起来**，卡里 `CardTitle`
   当小标题，表单栏位**并排**。这一段就是那个形状，用我们自己的零件重建。 */
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
    <Card className="mt-4 first:mt-0">
      <CardTitle hint={body}>{title}</CardTitle>
      {children}
    </Card>
  );
}

/* 搬进 ../kit.tsx —— console 那边也在手写同一行。 */
const Row = DataRow;


/** One person who works here, as the owner sees them. */
export type Member = {
  user_id: string;
  email: string;
  role: string;
  active: boolean;
};

/**
 * 谁在这里工作 —— the only way to use the permission system without SQL.
 *
 * ⚠️ WHY 「ADD」 CANNOT INVITE A STRANGER. `add_project_member` looks the email
 * up in `auth.users` and refuses when it is not there, on purpose: a row
 * pointing at nobody would look like a supervisor who exists and cannot sign
 * in. Sending an invitation email is a real feature -- it needs a sender, a
 * token and an expiry -- and pretending to have it is worse than saying so.
 * That refusal is the one message this form has to translate carefully, which
 * is why it is matched on rather than shown raw.
 *
 * ⚠️ AND NOBODY IS DELETED. 「关掉」 is the only removal there is, because
 * `recorded_by` on every row he wrote points at him -- the founder's own
 * vibe-dealer 0036 made the same call for the same reason.
 */
function TeamPanel({ initial }: { initial: Member[] }) {
  const t = useTranslations("portal.account");
  const [members, setMembers] = useState<Member[]>(initial);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ key: string; ok: boolean } | null>(null);

  async function reload() {
    const { data } = await createBrowserSupabaseClient().rpc("list_project_members");
    setMembers((data as Member[] | null) ?? []);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setNote(null);
    const { error } = await createBrowserSupabaseClient().rpc("add_project_member", {
      in_email: email.trim(),
    });
    setBusy(null);
    if (error) {
      /* The one failure with its own answer: he typed a real address for
         somebody who has not signed up. Telling him 「could not add」 there
         would send him back to check a spelling that was right. */
      const first = /no account yet/i.test(error.message ?? "");
      return setNote({ key: first ? "teamSignUpFirst" : "teamFailed", ok: false });
    }
    setEmail("");
    await reload();
  }

  async function toggle(m: Member) {
    setBusy(m.user_id);
    await createBrowserSupabaseClient().rpc("set_member_active", {
      in_user_id: m.user_id,
      in_active: !m.active,
    });
    setBusy(null);
    await reload();
  }

  return (
    <Section title={t("teamTitle")} body={t("teamBody")}>
      {note && (
        <p
          role="status"
          className="mb-4 max-w-xl rounded-[var(--radius-md)] border px-3.5 py-2.5 [font-size:var(--text-sm)] [border-color:var(--color-clay)] [color:var(--color-clay-bright)]"
        >
          {t(note.key)}
        </p>
      )}

      {members.length === 0 ? (
        <p className="mb-4 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
          {t("teamEmpty")}
        </p>
      ) : (
        <ul className="mb-5 max-w-xl">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between gap-4 border-b py-2.5 last:border-b-0 [border-color:var(--color-ink-850)]"
            >
              <span className="min-w-0">
                <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)]">
                  {m.email}
                </span>
                <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                  {m.active ? t("teamRoleStaff") : t("teamOffLabel")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggle(m)}
                disabled={busy !== null}
                className={`${button} shrink-0`}
              >
                {m.active ? t("teamOff") : t("teamOn")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex max-w-sm flex-col gap-3">
        <Field label={t("teamEmail")} htmlFor="team-email">
          <input
            id="team-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={control}
          />
        </Field>
        <button type="submit" disabled={busy !== null} className={`${btn("quiet")} self-start`}>
          {busy === "add" ? t("teamAdding") : t("teamAdd")}
        </button>
      </form>
    </Section>
  );
}
