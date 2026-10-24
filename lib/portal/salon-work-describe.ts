import { describeDay } from "./layout-ops";

/**
 * 给新版沙龙十四页（`salon-preview/`）用的"把画面上的真记录讲给模型听"，
 * 跟 `describeLayout`（`layout-ops.ts`）平行，不是它的替代品。
 *
 * ── 为什么要另外一支 ──────────────────────────────────────────────────
 *
 * `describeLayout` 走的是一棵 Puck 排版树（`@puckeditor/core` 的 `Data`），
 * 从每个块的 `props` 里认出 `DaySchedule`/`RecordTable` 这些形状，
 * 再呼叫 `describeDay`/`describeRows` 产生 `record=<uuid> ...` 这种给模型
 * 认的文字。而新版十四页是真的 React server component，直接从 Supabase 抓
 * 资料、直接渲染——**没有那棵树**，造一棵假的只是为了塞进这支函式，
 * 比直接把真资料喂给 `describeDay` 更绕，而且还要维护一份"怎么把
 * `appointments` 表的一行塞成一个假 Puck block"的翻译层。
 *
 * ── 为什么不重写一份 describeDay 的格式 ──────────────────────────────
 *
 * `describeDay` 产生的 `bookings(n)=[record=<id> at="..." who="..." ...]`
 * 这个格式，`/api/portal/edit` 那支 route 的系统提示词（WORK_OPS 清单、
 * 「这是他能做的事」那一段）已经在教模型怎么读——那段提示词一个字不改，
 * 这里只是换一个来源喂同一个格式。两份格式不一样，就是两套要教模型的东西，
 * 这个仓库在"第二份手写清单"上栽过太多次了。
 *
 * ── 这一支只覆盖"操作已有一行"的那几个动作 ────────────────────────────
 *
 * 大多数 `WORK_OPS` 动作（book_appointment、add_ledger_entry 那一类"开新的"）
 * 根本不需要"回指画面上已显示的某一行"——只需要知道 `pageKey` 是什么形状
 * 加对话内容。只有 `mark_appointment_arrived`/`claim_booking_party` 这类
 * "动已经在的一行"的动作，才需要模型先看到一份"今天这几笔预约，各自的
 * 真编号是什么"的清单。`record_id` 的合法性验证完全在资料库层
 * （RLS + 每支 RPC 自己的 works_here/sees_money 检查），这里产生的文字
 * 只是降低模型编错编号的机率，不是安全机制——编错了 RPC 会直接拒绝。
 */

export type SalonAppointmentForDescribe = {
  id: string;
  startsAt: string;
  endsAt: string;
  party: string;
  service: string;
  staffName: string | null;
};

/**
 * 今天（或他正在看的那一天）的预约清单，照 `describeDay` 要的
 * `{time, endTime, title, description, who, where, href}[]` 形状摆好。
 *
 * `href` 只是拿来让 `describeDay` 自己的 `RECORD_ID` 正则从里面挖出
 * 真编号——跟画面上那条连结是不是真的能点无关，这里只服务提示词，
 * 不服务浏览器。
 */
export function describeSalonAppointments(
  appts: SalonAppointmentForDescribe[],
): string {
  const clock = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));

  const rows = appts.map((a) => ({
    time: clock(a.startsAt),
    endTime: clock(a.endsAt),
    title: a.party || "",
    description: a.service || "",
    who: a.staffName ?? "",
    href: `/appointment/${a.id}`,
  }));

  const body = describeDay({ rows });
  if (!body) return "";
  return `- id=today-appointments type=DaySchedule (Today's Appointments)${body}`;
}
