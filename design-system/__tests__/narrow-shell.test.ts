import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 两件用眼睛看出来的事，写成会红的守卫。
 *
 * [重点 24](../../docs/founder-points.md)：**眼睛判像不像，尺子判有没有再犯。**
 * 2026-09-04 手机上第一次真的画出老板自己的系统（[任务 141](../../docs/founder-tasks.md)），
 * 一张截图里翻出下面两件 —— 两件都是**量得到、而且没有任何检查在量**的。
 *
 * 这两条读的是原始码，不是画面。理由是它们守的东西 jsdom 量不到（没有排版），
 * 而它们各自都只有一个字串可以出错。一条会红的字串守卫，比一条量不到的检查有用。
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("窄屏那条侧栏要滚，不要长出去", () => {
  /**
   * 实测 390px，2026-09-04：那条 `aside` 宽 **993**，`clientWidth` 也是 993 ——
   * 它没有在滚，它是真的那么宽，而外面那一层把多出来的 603px 剪掉了。
   * **六个页面连结在画面外，而且没有任何方法到得了。**
   *
   * `overflow-x-auto` 从来就写在那条 `aside` 上，只是永远没有机会生效：
   * flex 项目的 `min-width` 预设是 `auto`（不准缩到比内容窄）。
   * 而且要**两层一起**才行 —— `sidebar` 是 Puck 的插槽，中间还有一层
   * 我们改不到 class 的 div，同样是 flex 项目、同样 `min-width:auto`。
   * 只修其中一层，量出来是 993 → 993。
   */
  it("侧栏那一格跟它里面那一层都要 min-w-0", () => {
    const shell = read("design-system/components/system-shell.tsx");
    expect(shell).toContain("min-w-0 [&>*]:min-w-0");
  });

  it("aside 自己也要 min-w-0", () => {
    const rail = read("design-system/components/rail-nav.tsx");
    expect(rail).toContain("flex min-w-0 shrink-0 border-r");
  });
});

describe("并排那两栏，不准把一张表压扁", () => {
  /**
   * `columns.tsx` 的 `CELL` 往下数三层是照**编辑器**数的（插槽的包装 ·
   * Puck 每一项的包装 · 那一块）。而 `<Render>` 只有两层 —— Puck 在编辑器
   * 外面不包每一项 —— 所以在**已发布的页 · 师傅看到的页 · 手机上**，
   * 第三层会落到那一块**里面的每一段**上。
   *
   * 实测 390 的客户页：RecordTable 四段的自然高度是 24 / 38 / 606 / 20，
   * 每一段拿到 `h-full` 之后，那一列的高度由内容算出来（736），再把 736
   * 发给每一个孩子 —— flex 於是把它们压回 173 / 173 / 174 / 186。
   * **七个客户被塞进一个 174px 的窗口里自己滚，上面还有 321px 的空白。**
   *
   * `:only-child` 就是那个分界：一块是它那层包装里唯一的东西，
   * 而一块自己的那几段永远不是。
   */
  it("最深那一层要挂 :only-child", () => {
    const columns = read("design-system/components/columns.tsx");
    expect(columns).toContain("[&>*>*>*:only-child]:h-full");
    // 没有 :only-child 的那一版不可以回来
    expect(columns).not.toContain("[&>*>*>*]:h-full");
  });

  /** bento 抄的是同一条链，同一个坑。它今天还没有被这个洞咬到
   *  （里面装的都是单段的块），所以这一条只是把它钉在名单上：
   *  哪一天有人把一张表放进 bento，这里要一起改。 */
  it("bento 用的是同一条链，改的时候要一起看", () => {
    const bento = read("design-system/components/bento.tsx");
    expect(bento).toContain("[&>*>*>*]:h-full");
  });
});
