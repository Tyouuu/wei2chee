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
const files = () => readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const newestDefining = (marker: string) => {
  const file = [...files()].reverse().find((f) =>
    readFileSync(join(dir, f), "utf8").includes(marker),
  );
  if (!file) throw new Error(`no migration defines ${marker}`);
  return readFileSync(join(dir, file), "utf8");
};

/**
 * Who may execute a function TODAY, as the migrations say it.
 *
 * ⚠️ WHY THIS IS NOT JUST `newestDefining(...)`. It was, and it broke the
 * moment a migration restated the privileges without restating the body:
 * 20260901040000 says only 「revoke ... grant ... to authenticated」, and
 * because its text contains the function's name it became 「the newest
 * migration defining add_pipeline_record」 -- so four assertions about the
 * BODY started reading a file that has no body in it. One red guard became
 * five, none of which described a real defect.
 *
 * A declaration and a grant are two different statements about one function
 * and they can honestly live in different migrations. So they are looked up
 * separately, and the real invariant is asserted directly: the grant must be
 * at or after the latest declaration, because a re-declaration that CHANGES
 * the signature resets privileges to Postgres's default -- EXECUTE for PUBLIC.
 */
const declaresRe = (fn: string) =>
  new RegExp(`create (or replace )?function public\\.${fn}\\(`);

/**
 * The newest migration that actually DECLARES it -- not merely one that names
 * it. `newestDefining` matches any mention, which is right for an index and
 * wrong for a function whose privileges may be restated on their own.
 */
const newestDeclaring = (fn: string) => {
  const re = declaresRe(fn);
  const file = [...files()].reverse().find((f) => re.test(readFileSync(join(dir, f), "utf8")));
  if (!file) throw new Error(`no migration declares ${fn}`);
  return readFileSync(join(dir, file), "utf8");
};

const privilegesFor = (fn: string) => {
  const declares = declaresRe(fn);
  const grants = new RegExp(`grant execute on function public\\.${fn}\\(`);
  const all = files();
  const lastDecl = [...all].reverse().find((f) =>
    declares.test(readFileSync(join(dir, f), "utf8")),
  );
  const lastGrant = [...all].reverse().find((f) =>
    grants.test(readFileSync(join(dir, f), "utf8")),
  );
  return {
    lastDecl,
    lastGrant,
    grantSql: lastGrant ? readFileSync(join(dir, lastGrant), "utf8") : "",
  };
};

describe("add_pipeline_record", () => {
  const sql = newestDeclaring("add_pipeline_record");

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

  it("cannot leave a second overload behind", () => {
    /* Two functions of the same name, one of which quietly ignores the
       idempotency key, is how this defect comes back -- Postgres picks by
       argument list, and a caller that omits the new parameter would get the
       old body.

       ⚠️ The check was literally 「contains a drop」, which is only one of the
       two safe ways. `create or replace` on the SAME signature cannot create
       an overload at all, and 20260831090000 -- restoring a handler with no
       signature change -- is exactly that case. A guard that fails a correct
       migration teaches the next person to weaken it, so it now asserts the
       thing it was defending: a NEW signature must drop the old one. */
    const declares = /create (or replace )?function public\.add_pipeline_record/.exec(sql);
    expect(declares, "no migration declares it").toBeTruthy();
    if (!declares?.[1]) {
      expect(sql).toContain("drop function if exists public.add_pipeline_record");
    }
  });

  it("still carries what the row is about", () => {
    expect(sql).toContain("in_title text");
  });

  it("is reachable by a signed-in customer and nobody else", () => {
    /* Stated at or after the newest declaration -- see privilegesFor. A
       re-declaration that changes the signature makes a NEW function, and a
       new function is executable by PUBLIC (which includes anon) until
       something says otherwise. */
    const { lastDecl, lastGrant, grantSql } = privilegesFor("add_pipeline_record");
    expect(lastGrant, "no migration grants it").toBeTruthy();
    expect(
      lastGrant! >= lastDecl!,
      `re-declared in ${lastDecl} with no grant after it`,
    ).toBe(true);
    expect(grantSql).toMatch(/grant execute on function public\.add_pipeline_record[\s\S]*?to authenticated/);
    expect(grantSql).toMatch(/revoke execute on function public\.add_pipeline_record[\s\S]*?from public/);
    expect(grantSql).not.toMatch(/grant execute on function public\.add_pipeline_record[\s\S]*?to anon/);
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
