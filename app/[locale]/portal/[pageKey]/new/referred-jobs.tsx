import Link from "next/link";
import type { RecordFormCopy } from "../record-copy";

/**
 * 「他替我带过几单，我还欠他多少。」
 *
 * ── 为什么它在这个人的那一页 ──────────────────────────────────────────────
 *
 * 因为他真正要做的动作是**打给阿明**，而不是逐张单对帐 ——
 * 20260905260000 的档头自己就写着这一句。他点开阿明，
 * 看到「带了三单 · 答应 RM 900 · 给了 RM 300 · 还欠 RM 600」，
 * 然后按那个 WhatsApp。一张全店的介绍费清单回答的是另一个问题。
 *
 * ── 🔴 每一个数字都是资料库算的 ──────────────────────────────────────────
 *
 * `referrals_owing` 一行一个介绍人，`referred_jobs` 一行一张单，
 * 两支用同一段 SQL 算 `promised`。这一页**一个数字都不重算** ——
 * 同一个问题两个答案，这个仓库栽过至少八次。
 *
 * ⚠️ 而「给了多少」不是一个旗子，是**加出来的**：方向是出 · 收款人是他 ·
 * 而且挂在这几单其中一单上。所以它跟他自己的帐永远不会打架 ——
 * 一个存起来的「付了」会。
 *
 * ── 一单都没带过就整段不画 ────────────────────────────────────────────────
 *
 * 不是画一份「0 单 · RM 0」。绝大多数客户从来没有介绍过人，
 * 而一段永远写着 0 的区块，读起来是这一页没做完。
 */

export type ReferredJob = {
  id: string;
  href: string;
  docNo: string;
  title: string;
  party: string;
  /** 这一单收到多少 —— 比例就是算在它上面的 */
  received: string;
  /** 这一单欠他多少 */
  promised: string;
};

export type ReferralTally = {
  jobs: number;
  received: string;
  promised: string;
  paid: string;
  owing: string;
};

export function ReferredJobs({
  tally,
  jobs,
  copy,
}: {
  tally: ReferralTally;
  jobs: ReferredJob[];
  copy: RecordFormCopy;
}) {
  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.sentHeading}
        </h2>
        <p className={`mt-1 max-w-[62ch] ${dim}`}>{copy.sentLede}</p>
      </div>

      {/* 🔴 「还欠」最大 —— 那一个数字就是他打这通电话的理由，
          其余三个是拿来解释它的。对帐那一页 9-05 学到的同一条。 */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className={dim}>{copy.sentOwing}</span>
          <span className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-on-canvas)]">
            {tally.owing}
          </span>
        </div>
        {[
          [copy.sentJobs, String(tally.jobs)],
          [copy.sentPromised, tally.promised],
          [copy.sentPaid, tally.paid],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <span className={dim}>{label}</span>
            <span className="[font-size:var(--text-base)] [font-weight:var(--fw-medium)] tabular-nums text-[color:var(--color-on-canvas)]">
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* 一行一单，而且点得进去 —— 他要看的下一件事就是那张单 */}
      <ul className="flex flex-col">
        {jobs.map((j) => (
          <li key={j.id} className="border-t [border-color:var(--color-ink-800)]">
            <Link
              href={j.href}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                <span className="tabular-nums">{j.docNo}</span>
                {j.title ? ` · ${j.title}` : ""}
                {j.party ? <span className={` ${dim}`}>{` · ${j.party}`}</span> : null}
              </span>
              <span className="[font-size:var(--text-sm)] tabular-nums text-[color:var(--color-on-canvas)]">
                {/* 收到多少 → 欠他多少。中间那个箭头就是这一段的算术。 */}
                <span className={dim}>{j.received}</span>
                {" → "}
                {j.promised}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
