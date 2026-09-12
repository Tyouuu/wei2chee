import { fontVariables } from "@/app/fonts";
import "../globals.css";

/**
 * 她自己那张预约的那一页的根 —— 第五个根 layout。
 *
 * 跟 `app/c/layout.tsx` 一字不差的理由（那一条是看图才看到的：`/p/` 第一版
 * 没有这个档案，整页衬线字、没有边框，而每一条断言都是绿的）。
 *
 * 没有 next-intl：这一页讲的是那套系统自己的语言（`public_appointment`
 * 回的 `system_language`），不是打开它的人浏览器设定的语言。
 * 没有我们的标题跟分享卡：这一页上不该出现 Formae 这个字。
 */
export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    /* 自己铺白底，不要靠 globals.css 那块地——那一块是 Formae 的壳，是深色的。 */
    <html lang="en" className={fontVariables}>
      <body className="bg-white text-neutral-900">{children}</body>
    </html>
  );
}
