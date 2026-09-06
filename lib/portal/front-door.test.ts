import { describe, expect, it } from "vitest";
import { frontDoor } from "./front-door";

describe("正门开在哪一边", () => {
  const owner = { isOwner: true };

  /* 🔴 2026-09-07 起这一条不再问「保存过没有」。老板拍的板 ——
     一份还没保存过的草稿本来打开的是编辑器，而那一屏里**他自己的按钮
     一颗都按不动**（Puck 把点击收去选块，重试 55 次 30 秒一次都没穿过）。
     见 front-door.ts 的档头。 */
  it("一进来就是他的系统 —— 保存过没有都一样", () => {
    expect(frontDoor(owner)).toBe("system");
  });

  it("他按了「改设计」才进编辑器", () => {
    expect(frontDoor({ ...owner, design: "1" })).toBe("editor");
  });

  it("`?add=` 跟 `?tpl=` 的目的地就是设计", () => {
    expect(frontDoor({ ...owner, add: "RecordTable" })).toBe("editor");
    expect(frontDoor({ ...owner, tpl: "quote" })).toBe("editor");
  });

  /* 🔴 这一条是这支函式真正在守的东西。一个网址参数不可以变成一条绕过角色的路。 */
  it("师傅永远到不了编辑器，带 ?design=1 也不行", () => {
    expect(frontDoor({ isOwner: false, design: "1" })).toBe("system");
    expect(frontDoor({ isOwner: false, design: "1", add: "x", tpl: "y" })).toBe(
      "system",
    );
  });

  /* ⚠️ 这一条钉住的是**没有第二条路**：编辑器只有一个入口，就是那三个参数。
     少了它，下一个人加一个「新客户第一次进来给编辑器」的条件回去，
     而这一整件事就是在拆掉那个条件。 */
  it("除了那三个参数，没有别的东西开得了编辑器", () => {
    expect(frontDoor({ isOwner: true, design: "0" })).toBe("system");
    expect(frontDoor({ isOwner: true, design: "", add: "", tpl: "" })).toBe(
      "system",
    );
  });
});
