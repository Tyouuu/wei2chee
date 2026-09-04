import { describe, expect, it } from "vitest";
import { frontDoor } from "./front-door";

describe("正门开在哪一边", () => {
  const owner = { isOwner: true, acceptedAsHis: true };

  it("他保存过之后，打开的是他的系统", () => {
    expect(frontDoor(owner)).toBe("system");
  });

  it("一份他还没保存过的草稿，打开的是编辑器 —— 那是我们卖的那一屏", () => {
    expect(frontDoor({ isOwner: true, acceptedAsHis: false })).toBe("editor");
  });

  it("他按了「改设计」就进编辑器", () => {
    expect(frontDoor({ ...owner, design: "1" })).toBe("editor");
  });

  it("`?add=` 跟 `?tpl=` 的目的地就是设计", () => {
    expect(frontDoor({ ...owner, add: "RecordTable" })).toBe("editor");
    expect(frontDoor({ ...owner, tpl: "quote" })).toBe("editor");
  });

  /* 🔴 这一条是这支函式真正在守的东西。一个网址参数不可以变成一条绕过角色的路。 */
  it("师傅永远到不了编辑器，带 ?design=1 也不行", () => {
    expect(frontDoor({ isOwner: false, acceptedAsHis: true, design: "1" })).toBe("system");
    expect(frontDoor({ isOwner: false, acceptedAsHis: false, design: "1", add: "x", tpl: "y" })).toBe("system");
  });

  /* 问的是整套，不是这一页 —— 见档头。这一条用「他只保存过官网那一页」
     那个真实情况写：客户那一页从来没存过，而他打开它要看到的是他的系统。 */
  it("整套接受了，一页都没保存过的那几页照样是他的系统", () => {
    expect(frontDoor({ isOwner: true, acceptedAsHis: true })).toBe("system");
  });
});
