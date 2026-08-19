import { describe, it, expect, beforeEach } from "vitest";
import { readLocalDraft, writeLocalDraft, localDraftKey } from "../../local-draft";

describe("local draft safety net", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been saved yet", () => {
    expect(readLocalDraft("proj-1", "dashboard")).toBeNull();
  });

  it("round-trips a written draft", () => {
    const data = { content: [{ type: "PageHeader", props: { title: "hi" } }] };
    writeLocalDraft("proj-1", "dashboard", data);
    expect(readLocalDraft("proj-1", "dashboard")).toEqual(data);
  });

  it("keys drafts separately per project and page", () => {
    writeLocalDraft("proj-1", "dashboard", { a: 1 });
    writeLocalDraft("proj-1", "customers", { a: 2 });
    writeLocalDraft("proj-2", "dashboard", { a: 3 });

    expect(readLocalDraft("proj-1", "dashboard")).toEqual({ a: 1 });
    expect(readLocalDraft("proj-1", "customers")).toEqual({ a: 2 });
    expect(readLocalDraft("proj-2", "dashboard")).toEqual({ a: 3 });
  });

  it("produces the expected storage key shape", () => {
    expect(localDraftKey("proj-1", "dashboard")).toBe("formae-portal-draft:proj-1:dashboard");
  });
});
