import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordTable } from "./record-table";

/**
 * The face in a row belongs to the person the row is about.
 *
 * ── THE DEFECT THIS HOLDS SHUT ────────────────────────────────────────────
 *
 * `RecordTableRow`'s avatar shape drew its initials from the DETAIL cell --
 * the second column -- because that is the cell it happens to be rendering.
 * Against the sample rows this looked right: 「Taman Desa · 013-2xx xxxx」
 * gives 「Ta」, which reads like a place and nobody questioned it.
 *
 * Then 客户 became a real table (2026-08-31). The second column is now a
 * COMPOSED contact line, WhatsApp number first, so on the demo account's own
 * page 陈先生 had a circle beside him reading 「06」 and 建材行 A one reading
 * 「王·」 -- two digits of a phone, and a name with the separator dot attached.
 *
 * ⚠️ Nothing caught it. 496 unit tests, 29 assertions against the real
 * database with a real customer session, and tsc were all green; it was found
 * by opening the page and looking at it (重点 3 / 7l). This is that look,
 * turned into something that fails on its own -- because a defect the eye
 * found and the ruler cannot measure comes back.
 */
describe("the avatar row shape", () => {
  const table = {
    columns: [
      { key: "primary", label: "Client", kind: "text" as const },
      { key: "secondary", label: "Contact / notes", kind: "detail" as const },
      { key: "status", label: "Status", kind: "status" as const },
    ],
    rows: [
      {
        cells: { primary: "陈先生", secondary: "012-345 6789", status: "施工中" },
        tones: { status: "neutral" as const },
      },
    ],
  };

  const markup = () =>
    renderToStaticMarkup(<RecordTable gridId="t" caption="Clients" table={table} row="avatar" />);

  /* ⚠️ THE BADGE, NOT THE PAGE.
     The first version of this asserted on the whole markup -- toContain("陈"),
     not.toMatch(/>01</) -- and it PASSED with the defect still in place: 陈先生
     is in the first column either way, and the initials of 「012-345 6789」 are
     「06」, not 「01」. A guard measuring next to the thing it guards is the same
     class of lie as a ruler reading a proxy (任务 23d). It is read out of the
     Avatar's own element now, and it has been watched going red. */
  const badge = (out: string) => out.match(/<span class="grid shrink-0[^>]*>([^<]*)</)?.[1];

  it("takes its initials from the person, not from the contact line", () => {
    expect(badge(markup())).toBe("陈");
  });

  it("still shows the contact line beside it", () => {
    // The fix must not swap the cell's own text for the name.
    expect(markup()).toContain("012-345 6789");
  });

  it("falls back to the cell when a row has no name at all", () => {
    /* Not reachable through add_directory_entry, which refuses a blank name --
       but a legacy saved page can carry a row like this, and an empty circle
       is worse than a wrong one. */
    const out = renderToStaticMarkup(
      <RecordTable
        gridId="t"
        caption="Clients"
        table={{ ...table, rows: [{ cells: { secondary: "王老板" }, tones: {} }] }}
        row="avatar"
      />,
    );
    expect(badge(out)).toBe("王");
  });
});
