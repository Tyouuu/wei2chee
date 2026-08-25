import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";

/**
 * 官网来的询价 — the other end of the arrow.
 *
 * WHY IT IS A PAGE IN FORMAE'S OWN CHROME AND NOT A BLOCK IN THE CUSTOMER'S
 * SYSTEM. The finished system, the one a build team delivers after the
 * RM 5,000, puts these rows straight into the business's own 报价单 / 预约 /
 * 订单 page -- which is what the line under the form promises and what
 * `lands_in` records against every row. That page is a Puck layout: it is the
 * customer's to rearrange, and wiring live database rows into a block they can
 * delete is a different piece of work with a different failure mode.
 *
 * So the inbox lands HERE first: real enquiries, visible the moment they
 * arrive, in the shell the owner is already signed into. It is the honest
 * intermediate -- the arrow is connected and the owner can see it fire, without
 * pretending the generated preview is already the finished system.
 */
export default async function EnquiriesPage() {
  const t = await getTranslations("portal");
  const supabase = await createSessionSupabaseClient();
  const { data } = await supabase.rpc("my_site_enquiries");
  const rows = (data ?? []) as {
    id: string;
    name: string;
    contact: string;
    answers: Record<string, string>;
    lands_in: string;
    status: string;
    created_at: string;
  }[];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="[font-size:var(--text-title)] font-semibold">
        {t("enquiries")}
      </h1>
      <p className="mt-2 max-w-[62ch] text-sm opacity-70">{t("enquiriesBlurb")}</p>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-sm opacity-60">
          {t("enquiriesEmpty")}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-medium">{r.name}</span>
                <a
                  className="text-sm underline underline-offset-2"
                  href={`https://wa.me/${r.contact.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.contact}
                </a>
                <span className="ml-auto text-xs tabular-nums opacity-60">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              {Object.entries(r.answers ?? {}).map(([k, v]) => (
                <p key={k} className="mt-2 text-sm opacity-80">
                  <span className="opacity-60">{k}：</span>
                  {String(v)}
                </p>
              ))}
              <p className="mt-3 text-xs opacity-55">
                {t("enquiriesLandsIn", { page: r.lands_in })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
