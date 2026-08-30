import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
  THE RPC IS THE ONLY WRITER, SO ITS SHAPE IS A CONTRACT.

  add_pipeline_record has been re-declared three times in two days -- for the
  title column, then idempotency -- and each re-declaration drops the previous
  overload. Postgres would otherwise keep them side by side, and a caller
  reaching the older one would silently write rows with no subject or no
  idempotency key: a duplicate quotation that nobody can explain.

  These read the migrations rather than the database so they run anywhere, and
  they check the two things a re-declaration is most likely to get wrong.
*/
const dir = join(process.cwd(), "supabase", "migrations");
const newestDefining = (marker: string) => {
  const file = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .find((f) => readFileSync(join(dir, f), "utf8").includes(marker));
  if (!file) throw new Error(`no migration defines ${marker}`);
  return readFileSync(join(dir, file), "utf8");
};

describe("add_pipeline_record", () => {
  const sql = newestDefining("function public.add_pipeline_record");

  it("takes an idempotency key, so a second press is not a second quotation", () => {
    // Proven before the fix: press, wait 400ms on a slow connection, press
    // again -- QT-2026-0001 and QT-2026-0002 for one job.
    expect(sql).toContain("in_idempotency_key uuid");
  });

  it("returns the existing row for a repeated key rather than raising", () => {
    // A retry is not a mistake: the client cannot know whether the first call
    // landed, so the only true answer is the row it already made.
    expect(sql).toMatch(/idempotency_key = in_idempotency_key/);
    expect(sql).toContain("return row;");
  });

  it("survives two presses in the same instant", () => {
    // Both miss the lookup and race the insert; the unique index decides and
    // the loser reads the winner's row instead of showing an error.
    expect(sql).toContain("unique_violation");
  });

  it("drops the previous overload", () => {
    // Two functions of the same name where one quietly ignores the key is how
    // this defect would come back.
    expect(sql).toContain("drop function if exists public.add_pipeline_record");
  });

  it("still carries what the row is about", () => {
    expect(sql).toContain("in_title text");
  });

  it("is reachable by a signed-in customer and nobody else", () => {
    expect(sql).toMatch(/grant execute on function public\.add_pipeline_record[^;]*to authenticated/);
    expect(sql).toMatch(/revoke execute on function public\.add_pipeline_record[^;]*from public/);
  });
});

describe("the idempotency index", () => {
  const sql = newestDefining("pipeline_records_idempotency_idx");

  it("is unique per project and ignores rows without a key", () => {
    // Partial, so every row written before this existed stays legal.
    expect(sql).toMatch(/create unique index[\s\S]*pipeline_records_idempotency_idx/);
    expect(sql).toMatch(/where idempotency_key is not null/);
  });
});
