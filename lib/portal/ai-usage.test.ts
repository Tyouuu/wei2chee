import { describe, it, expect, vi } from "vitest";
import { recordAiUsage } from "./ai-usage";
import type { SupabaseClient } from "@supabase/supabase-js";

const client = (rpc: unknown) => ({ rpc }) as unknown as SupabaseClient;

describe("recordAiUsage", () => {
  /*
    THE ONE THAT MATTERS.

    Accounting was added to two routes that were working fine without it. If a
    ledger write can throw, every one of those routes now has a new way to fail
    -- and it would fail for the customer, mid-sentence, over a row nobody but
    us will ever read. The table does not even exist until the migration is
    pushed, so this is not a hypothetical: it is the state the code ships in.
  */
  it("swallows a thrown error rather than failing the edit", async () => {
    const boom = vi.fn(() => {
      throw new Error("relation \"public.ai_usage\" does not exist");
    });
    await expect(
      recordAiUsage(client(boom), "edit", "gpt-5.6-luna", { prompt_tokens: 10, completion_tokens: 5 }),
    ).resolves.toBe(false);
  });

  it("swallows a returned error too", async () => {
    const rpc = vi.fn(async () => ({ error: { message: "nope" } }));
    await expect(
      recordAiUsage(client(rpc), "edit", "gpt-5.6-luna", { prompt_tokens: 1, completion_tokens: 1 }),
    ).resolves.toBe(false);
  });

  it("does nothing at all when the provider sent no usage", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    expect(await recordAiUsage(client(rpc), "edit", "gpt-5.6-luna", null)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the counts through, reasoning included", async () => {
    let args: Record<string, unknown> = {};
    const rpc = vi.fn(async (_name: string, a: Record<string, unknown>) => {
      args = a;
      return { error: null };
    });
    const ok = await recordAiUsage(client(rpc), "analyze", "gpt-5.6-luna", {
      prompt_tokens: 1200,
      completion_tokens: 340,
      completion_tokens_details: { reasoning_tokens: 300 },
    });
    expect(ok).toBe(true);
    expect(args.in_surface).toBe("analyze");
    expect(args.in_prompt_tokens).toBe(1200);
    expect(args.in_completion_tokens).toBe(340);
    // Billed as output and invisible in the reply -- dropping it under-reports
    // exactly the setting both callers run at (reasoning_effort "high").
    expect(args.in_reasoning_tokens).toBe(300);
  });

  it("keeps absent reasoning absent instead of calling it zero", async () => {
    let args: Record<string, unknown> = {};
    const rpc = vi.fn(async (_n: string, a: Record<string, unknown>) => {
      args = a;
      return { error: null };
    });
    await recordAiUsage(client(rpc), "edit", "gpt-5.6-luna", {
      prompt_tokens: 5,
      completion_tokens: 5,
    });
    // 0 would be a claim that the model reasoned for nothing; null is the
    // truth, which is that this reply did not say.
    expect(args.in_reasoning_tokens).toBeNull();
  });

  /*
    THE ONE THE LEDGER WAS MISSING.

    Before this, a call that failed wrote nothing at all -- the early return on
    an absent `usage` is exactly the shape of every failure -- so the table
    reported a healthy 100% while every call in production was failing. This is
    the row that makes 「AI 坏了我们怎么知道」 answerable by something other than
    a customer telling us.
  */
  it("writes a row for a failure, which has no usage at all", async () => {
    let args: Record<string, unknown> = {};
    const rpc = vi.fn(async (_n: string, a: Record<string, unknown>) => {
      args = a;
      return { error: null };
    });
    const ok = await recordAiUsage(client(rpc), "edit", "gpt-5.6-luna", null, {
      outcome: "failed",
      tookMs: 9200,
    });
    expect(ok).toBe(true);
    expect(args.in_outcome).toBe("failed");
    expect(args.in_took_ms).toBe(9200);
    // Zero, not null: there is nothing to count, and a null count would read as
    // 「we do not know」 when in fact we do.
    expect(args.in_prompt_tokens).toBe(0);
  });

  /*
    A reply that was billed and then would not parse is ONE event with two
    facts: what it cost, and that it did not work. Splitting it into two rows
    would count the call twice and make the failure rate depend on how the
    failure happened.
  */
  it("keeps the counts on a failure that was already billed", async () => {
    let args: Record<string, unknown> = {};
    const rpc = vi.fn(async (_n: string, a: Record<string, unknown>) => {
      args = a;
      return { error: null };
    });
    await recordAiUsage(
      client(rpc),
      "analyze",
      "gpt-5.6-luna",
      { prompt_tokens: 4000, completion_tokens: 200 },
      { outcome: "failed", tookMs: 7000 },
    );
    expect(args.in_outcome).toBe("failed");
    expect(args.in_prompt_tokens).toBe(4000);
  });

  it("defaults to a success that took an unknown amount of time", async () => {
    let args: Record<string, unknown> = {};
    const rpc = vi.fn(async (_n: string, a: Record<string, unknown>) => {
      args = a;
      return { error: null };
    });
    await recordAiUsage(client(rpc), "edit", "gpt-5.6-luna", { prompt_tokens: 1, completion_tokens: 1 });
    expect(args.in_outcome).toBe("ok");
    // Null rather than 0 -- see the reasoning-tokens test: 0 is a claim.
    expect(args.in_took_ms).toBeNull();
  });
});
