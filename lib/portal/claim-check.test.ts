import { describe, it, expect } from "vitest";
import { claimStands } from "./claim-check";

const base = { applied: 0, skipped: 0, designPlanned: 0, designLanded: false };

describe("claimStands", () => {
  /*
    THE ELEVEN. Each of these is a real reply this product has shown a
    customer, reduced to what the browser knew at the moment it showed it.
  */
  it("refuses a sentence about an edit that was entirely turned away", () => {
    // 「把第一屏那句大标题改成…」 -> 「改了 1 处」 over a page that did not move,
    // because the field was one SiteHero does not declare.
    expect(claimStands({ ...base, skipped: 1 })).toBe(false);
  });

  it("refuses a 排法 sentence when no RPC was made", () => {
    // 「已将总览改为表格先行」 while the browser dropped the field on the floor.
    expect(claimStands({ ...base, designPlanned: 1, designLanded: false })).toBe(false);
  });

  it("lets a real edit speak", () => {
    expect(claimStands({ ...base, applied: 1 })).toBe(true);
  });

  it("lets a design change speak", () => {
    expect(claimStands({ ...base, designPlanned: 1, designLanded: true })).toBe(true);
  });

  /*
    A PARTIAL SUCCESS IS STILL A SUCCESS, AND ITS REFUSALS ARE ALREADY SHOWN.

    「一次讲三个」 is a real case: three operations, one rejected. The skipped
    list is rendered under the reply already, so blanking the sentence here
    would hide the two changes that DID happen in order to report the one that
    did not.
  */
  it("lets a partly-applied answer speak, because the refusals are listed", () => {
    expect(claimStands({ ...base, applied: 2, skipped: 1 })).toBe(true);
  });

  /*
    THE OTHER HALF, AND IT IS THE ONE MOST LIKELY TO BE BROKEN BY A CARELESS
    CHANGE HERE. An assistant that answers 「这个做不到」 or 「你是指哪一个？」 or
    「我可以帮你加一页员工排班」 has attempted nothing -- its sentence IS the
    answer. Treating that as an unfulfilled claim would replace every honest
    refusal with 「页面没有动过」, which is both true and useless.
  */
  it("leaves a refusal alone", () => {
    expect(claimStands(base)).toBe(true);
  });

  it("leaves a question alone", () => {
    expect(claimStands(base)).toBe(true);
  });

  it("leaves an offer alone", () => {
    // add_page / remove_page / pick_photo all come back with no operations:
    // the customer presses a button, and that is where the change happens.
    expect(claimStands(base)).toBe(true);
  });
});
