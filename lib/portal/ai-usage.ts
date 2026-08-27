import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODEL } from "./ai-model";

/**
 * What one model call cost, written down.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Every AI call in this product spends the founder's own OpenAI key -- the
 * questionnaire at signup and every sentence typed into the editor. Both are
 * behind auth and the editor is rate limited, and until now nothing recorded
 * what any of it cost. He pays that bill and cannot see what produced it.
 *
 * Puck's own AI reference has `ai.onFinish` for exactly this, next to a line
 * worth keeping: the handler is a metered surface spending the account's
 * credit. Ours is too; it just had no meter.
 *
 * ── WHAT IS NOT RECORDED ──────────────────────────────────────────────────
 *
 * No prompt, no reply, no page content, no sentence the owner typed. This
 * answers 「多少」 and nothing else. A business owner describing his own trade
 * is handing over something private, and a usage ledger is the wrong place for
 * it to pile up.
 *
 * ── REACHABLE FROM THE BROWSER, ON PURPOSE ─────────────────────────
 *
 * Both callers use the CUSTOMER'S OWN SESSION, not a service key, so the JWT
 * that reaches Postgres is theirs and `record_ai_usage` must be granted to
 * `authenticated`. Security definer stops them writing against anybody else's
 * account; it does not stop them calling the RPC directly with invented
 * numbers against their own.
 *
 * So the function itself drops impossible counts and caps rows per hour --
 * 20260827040000. Do not remove those guards on the assumption that this is
 * server-only. It is not, and the row it protects is the one the founder uses
 * to answer 「这个功能花我多少钱」.
 */
export type UsageShape = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  completion_tokens_details?: { reasoning_tokens?: number | null } | null;
} | null | undefined;

/**
 * ACCOUNTING MUST NEVER BE WHY AN EDIT FAILS.
 *
 * Awaited rather than fired and forgotten -- a serverless function can be torn
 * down the moment it returns, and an un-awaited insert is a row that arrives
 * only when the platform happens to be slow. But every error is swallowed: a
 * customer mid-sentence must not see 「修改失败」 because a ledger row could not
 * be written. The bill is our problem, the edit is theirs.
 *
 * Returns whether the row landed, so a caller that wants to know can ask.
 * Nothing in the product does yet; `check:ai-cost` reads the table instead.
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  /* Kept in step with ai_usage_surface_check by hand, which is the one
     hand-maintained list here -- the constraint is the authority and a
     value missing from it is rejected by Postgres, loudly, at the only
     moment it matters. */
  surface: "analyze" | "edit" | "spec",
  model: string,
  usage: UsageShape,
  /**
   * A FAILED CALL IS THE ONE WORTH RECORDING MOST.
   *
   * This used to return early whenever `usage` was absent, which is exactly
   * the shape of every failure: the provider 500s, the platform cuts the
   * request off at its ceiling, the reply will not parse -- and no row is
   * written at all. So the ledger answered 「花了多少钱」 and was silent on
   * 「它还在正常吗」, and the honest answer to 「AI 坏了我们怎么知道」
   * was: a customer tells us.
   *
   * A failure row carries zeroes, because there is nothing to count, and its
   * own outcome, because a zero-token success and a failure are different
   * events that would otherwise look identical.
   */
  opts: { outcome?: "ok" | "failed"; tookMs?: number | null } = {},
): Promise<boolean> {
  const outcome = opts.outcome ?? "ok";
  if (!usage && outcome === "ok") return false;
  try {
    const { error } = await supabase.rpc("record_ai_usage", {
      in_surface: surface,
      in_model: model,
      in_outcome: outcome,
      /* Wall clock around the model call. Rounded rather than passed as a
         float: the column is an integer and a millisecond of precision past
         the decimal point is not a thing anybody will ever ask about. */
      in_took_ms:
        typeof opts.tookMs === "number" && Number.isFinite(opts.tookMs)
          ? Math.max(0, Math.round(opts.tookMs))
          : null,
      in_prompt_tokens: Math.max(0, Math.round(usage?.prompt_tokens ?? 0)),
      in_completion_tokens: Math.max(0, Math.round(usage?.completion_tokens ?? 0)),
      /*
        Reasoning tokens are billed as output and never appear in the reply, so
        leaving them out under-reports precisely the setting both callers run
        at (reasoning_effort "high"). Null when the field is absent rather than
        0, because 0 is a claim and absent is an absence.
      */
      in_reasoning_tokens:
        usage?.completion_tokens_details?.reasoning_tokens == null
          ? null
          : Math.max(0, Math.round(usage.completion_tokens_details.reasoning_tokens)),
    });
    return !error;
  } catch {
    return false;
  }
}

/*
  PRICES GO STALE. This repo has been bitten five times in one day by a fact
  written down next to code that outlived it, so these carry their date in the
  name and `check:ai-cost` prints it beside every figure. They are USD per
  million tokens, and they are a stand-in the founder can correct in one place
  -- not a number to quote at anybody.
*/
export const PRICE_PER_MTOK_USD_2026_08_27: Record<string, { in: number; out: number }> = {
  [AI_MODEL]: { in: 1.25, out: 10 },
};
