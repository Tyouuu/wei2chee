import { fontVariables } from "@/app/fonts";
import "../globals.css";

/**
 * 她签那一份表单的那一页的根 —— 第四个根 layout。
 *
 * ── 为什么要一个 ──────────────────────────────────────────────────────────
 *
 * 跟 `app/p/layout.tsx` 一字不差的理由，而那一条是**看图才看到的**：
 * `/p/<号码>` 第一版没有这个档案，於是那底下一行样式都没有载入 ——
 * 整页衬线字、没有边框、没有间距，而**每一条断言都是绿的**
 * （版心有宽 · 按钮有底色，两个都对，而画面是坏的）。
 * [重点 7l]：数字过关不等於眼睛过关。
 *
 * ── 故意没有的 ────────────────────────────────────────────────────────────
 *
 * 没有 next-intl：这一页讲的是**那套系统自己的语言**
 * （`public_consent_form` 回的 `system_language`），不是打开它的人
 * 浏览器设定的语言。一个客人换了手机语言，不该换掉那门生意的用字。
 *
 * 没有我们的标题跟分享卡：这一页上不该出现 Formae 这个字 ——
 * 那是那门生意在跟她的客人讲话。
 */
export default function ConsentLayout({ children }: { children: React.ReactNode }) {
  return (
    /* 🔴 **自己铺白底，不要靠 globals.css 那块地。** 那一块是 Formae 的壳，
       而它是**深色的** —— `/p/` 第一版就是这样变成近黑底配近黑字的。 */
    <html lang="en" className={fontVariables}>
      <body className="bg-white text-neutral-900">{children}</body>
    </html>
  );
}
