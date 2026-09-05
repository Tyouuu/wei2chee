import { fontVariables } from "@/app/fonts";
import "../globals.css";

/**
 * 客人打开他自己那张单 —— 第四个根 layout。
 *
 * ⚠️ **有自己的根，而且一定要有。** `/p/` 那一次是看图才发现的：
 * 没有这个档案，底下一行 CSS 都不会载入 —— 整页衬线字、没有边框，
 * 而每一个 class 都还好好写在那里，什么都没报错。
 *
 * 跟 `/s/` · `/p/` 同一个理由：这一页不是 Formae 在跟老板讲话，
 * 是**那门生意在跟他的客人讲话**。一条要发给屋主的连结不该带我们的
 * 语言前缀，而且这里没有语言可以挑 —— 这一页讲那套系统自己的语言。
 *
 * ⚠️ **这里不铺白底**，跟 `/p/` 不一样：那一页是我们的形状，
 * 这一页穿的是**他自己那套风格的漆**（`StyleScope`，页面自己套），
 * 而那一层会自己铺地。在这里先铺一层白，会盖掉他选的那个开场色。
 */
export default function SharedRecordLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
