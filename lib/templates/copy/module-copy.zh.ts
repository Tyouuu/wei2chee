import type { IndustryLabels } from "../industry-template";
import type { ModuleCopy } from "./types";

/**
 * The vocabulary for each archetype the shape builders serve.
 *
 * Written in the trade's own words -- 尾款, 师傅, 上游, 账期 -- because the whole
 * claim this product makes is that the system arrives already speaking the
 * customer's language. A table headed "Item / Value / Status" is a demo; one
 * headed 「上游对账单 / 系统总额 / 差异」 is their month-end.
 *
 * `labels` carries the trade's three nouns, so a module reads correctly whether
 * the business calls its counterparties 客户, 顾客 or 经销商.
 */
export function moduleCopyZh(key: string, labels: IndustryLabels): ModuleCopy {
  switch (key) {
    case "reconciliation":
      return {
        title: "月度对账",
        subtitle:
          "上游给的总数，对系统里逐笔加起来的总数。差多少，差在哪一笔。",
        columns: {
          primary: "对账项目",
          secondary: "参考号",
          amount: "金额",
          status: "结果",
        },
        rows: [
          {
            primary: "系统逐笔总额",
            secondary: "本月 128 笔",
            amount: "RM 246,800",
            tone: "positive",
            status: "已核对",
          },
          {
            primary: "上游对账单总额",
            secondary: "对方出的数字",
            amount: "RM 246,800",
            tone: "positive",
            status: "对得上",
          },
          {
            primary: "待查差异",
            secondary: "REF-2026-0817",
            amount: "RM 0",
            tone: "neutral",
            status: "无差异",
          },
        ],
        hero: {
          label: "本月差异",
          value: "RM 0",
          suffix: "系统 vs 上游",
          stats: [
            { label: "系统总额", value: "RM 246,800", sub: "128 笔" },
            { label: "上游总额", value: "RM 246,800", sub: "对方出" },
            { label: "待查", value: "0 笔" },
          ],
        },
        variance: {
          title: "这个月对得上",
          description:
            "系统总额和上游对账单一致。有差异的时候，这里会列出要查的那几笔参考号。",
        },
      };

    case "commission":
      return {
        title: "佣金结算",
        subtitle: "这个月该拿多少，系统按每一笔自动算出来，不用再开 Excel。",
        columns: {
          primary: "结算对象",
          secondary: "计算方式",
          amount: "佣金",
          status: "状态",
        },
        rows: [
          {
            primary: `${labels.customer} A`,
            secondary: "成交额 × 2%",
            amount: "RM 1,240",
            tone: "positive",
            status: "已结",
          },
          {
            primary: `${labels.customer} B`,
            secondary: "成交额 × 2%",
            amount: "RM 860",
            tone: "warning",
            status: "待结",
          },
          {
            primary: `${labels.customer} C`,
            secondary: "成交额 × 2%",
            amount: "RM 415",
            tone: "neutral",
            status: "计算中",
          },
        ],
        hero: {
          label: "本月佣金",
          value: "RM 2,515",
          suffix: "比上个月",
          stats: [
            { label: "已结", value: "RM 1,240" },
            { label: "待结", value: "RM 860", tone: "caution" },
            { label: "计算中", value: "RM 415" },
          ],
        },
      };

    case "expenses":
      return {
        title: "开销记录",
        subtitle: "钱花去哪里了，每一笔附单据。跟收款对起来才知道真正赚多少。",
        columns: {
          primary: "开销项目",
          secondary: "付给谁",
          amount: "金额",
          status: "状态",
        },
        rows: [
          {
            primary: "材料采购",
            secondary: "建材行",
            amount: "RM 8,400",
            tone: "positive",
            status: "已付",
          },
          {
            primary: `${labels.staff}工资`,
            secondary: "本月",
            amount: "RM 12,000",
            tone: "positive",
            status: "已付",
          },
          {
            primary: "车油 / 过路费",
            secondary: "待报销",
            amount: "RM 640",
            tone: "warning",
            status: "待付",
          },
        ],
        hero: {
          label: "本月开销",
          value: "RM 21,040",
          suffix: "比上个月",
          stats: [
            { label: "已付", value: "RM 20,400" },
            { label: "待付", value: "RM 640", tone: "caution" },
            { label: "没单据", value: "1 笔", tone: "warn" },
          ],
        },
        upload: {
          label: "单据 / 发票",
          hint: "拍张照片或上传 PDF，这笔开销就有凭证了",
        },
      };

    case "reports":
      return {
        title: "月度报表",
        subtitle: "按月看趋势。要给会计、给银行、给自己看，都从这里导出。",
        columns: {
          primary: "月份",
          secondary: "笔数",
          amount: "营业额",
          status: "对比上月",
        },
        rows: [
          {
            primary: "2026 年 8 月",
            secondary: "128 笔",
            amount: "RM 71,300",
            tone: "positive",
            status: "增长",
          },
          {
            primary: "2026 年 7 月",
            secondary: "104 笔",
            amount: "RM 58,000",
            tone: "warning",
            status: "下滑",
          },
          {
            primary: "2026 年 6 月",
            secondary: "117 笔",
            amount: "RM 63,000",
            tone: "positive",
            status: "增长",
          },
        ],
        hero: {
          label: "本月营业额",
          value: "RM 71,300",
          suffix: "比上个月",
          stats: [
            { label: "笔数", value: "128 笔" },
            { label: "平均单价", value: "RM 557" },
            { label: "增长", value: "23%" },
          ],
        },
        trend: {
          title: "近六个月营业额",
          caption: "每一根是一个月的总额。",
          unit: "RM",
          points: [
            { label: "3月", value: 42000 },
            { label: "4月", value: 51000 },
            { label: "5月", value: 47000 },
            { label: "6月", value: 63000 },
            { label: "7月", value: 58000 },
            { label: "8月", value: 71300 },
          ],
        },
      };

    case "ranking":
      return {
        title: "活跃度排名",
        subtitle:
          "谁最努力、谁在退步。按金额、频率、最近有没有动，自动排等级。",
        columns: {
          primary: labels.customer,
          secondary: "最近一次",
          amount: "近 90 天",
          status: "等级",
        },
        rows: [
          {
            primary: `${labels.customer} A`,
            secondary: "2 天前",
            amount: "RM 48,500",
            tone: "positive",
            status: "顶级",
          },
          {
            primary: `${labels.customer} B`,
            secondary: "9 天前",
            amount: "RM 22,800",
            tone: "positive",
            status: "活跃",
          },
          {
            primary: `${labels.customer} C`,
            secondary: "41 天前",
            amount: "RM 3,200",
            tone: "warning",
            status: "退步中",
          },
        ],
        filter: { kind: "时间窗口", value: "近 90 天" },
        trend: {
          title: "活跃人数变化",
          caption: "顶级和活跃加起来的人数，按月看。",
          unit: "",
          points: [
            { label: "3月", value: 12 },
            { label: "4月", value: 14 },
            { label: "5月", value: 13 },
            { label: "6月", value: 17 },
            { label: "7月", value: 19 },
            { label: "8月", value: 23 },
          ],
        },
      };

    case "purchases":
      return {
        title: "进货单",
        subtitle: "向供应商订的货：订了什么、多少钱、到了没有、付了没有。",
        columns: {
          primary: "订的东西",
          secondary: "供应商",
          amount: "金额",
          status: "状态",
        },
        /* ⚠️ 状态是两件事的组合，不是一条直线。ERPNext 的采购单状态
           （To Receive and Bill · To Bill · To Receive · Completed）全部是
           「到货了没有」跟「付了没有」这两个独立事实的位置。一条把两者混在一起
           的流程，讲不出「货到了，钱还没付」—— 而那是一张采购单大部分时间待着
           的状态。示例这三行就是那三个位置。 */
        rows: [
          {
            primary: "水泥 200 包",
            secondary: "建材行 A",
            amount: "RM 4,800",
            tone: "warning",
            status: "等到货",
          },
          {
            primary: "铝框 · Taman Desa 那单",
            secondary: "五金店 B",
            amount: "RM 12,300",
            tone: "warning",
            status: "到了，未付",
          },
          {
            primary: "云石 · 厨房台面",
            secondary: "云石厂 C",
            amount: "RM 8,600",
            tone: "positive",
            status: "已付清",
          },
        ],
        searchPlaceholder: "搜索单号或供应商",
      };

    case "suppliers":
      return {
        title: "供应商",
        subtitle: "向谁进货、账期多久、这家还欠着多少。",
        columns: {
          primary: "供应商",
          secondary: "联络方式 / 账期",
          amount: "未付",
          status: "状态",
        },
        rows: [
          {
            primary: "建材行 A",
            secondary: "016-2xx xxxx · 30 天",
            amount: "RM 8,400",
            tone: "warning",
            status: "有欠款",
          },
          {
            primary: "五金店 B",
            secondary: "012-3xx xxxx · 现金",
            amount: "RM 0",
            tone: "positive",
            status: "已结清",
          },
          {
            primary: "云石厂 C",
            secondary: "018-8xx xxxx · 60 天",
            amount: "RM 15,200",
            tone: "neutral",
            status: "未到期",
          },
        ],
        searchPlaceholder: "搜索供应商",
      };

    case "staff":
      return {
        title: labels.staff,
        subtitle: "谁在做什么、这个月做了多少、工资怎么算。",
        columns: {
          primary: labels.staff,
          secondary: "负责",
          amount: "本月业绩",
          status: "状态",
        },
        rows: [
          {
            primary: `${labels.staff} A`,
            secondary: "3 单在做",
            amount: "RM 48,500",
            tone: "positive",
            status: "在职",
          },
          {
            primary: `${labels.staff} B`,
            secondary: "1 单在做",
            amount: "RM 22,800",
            tone: "positive",
            status: "在职",
          },
          {
            primary: `${labels.staff} C`,
            secondary: "休假中",
            amount: "RM 0",
            tone: "neutral",
            status: "请假",
          },
        ],
        searchPlaceholder: `搜索${labels.staff}`,
      };

    case "inventory":
      return {
        title: "库存",
        subtitle: "还有多少货、什么快没了、什么压太久没动。",
        columns: {
          primary: "货品",
          secondary: "位置 / 单位",
          amount: "数量",
          status: "状态",
        },
        rows: [
          {
            primary: "货品 A",
            secondary: "仓库一 · 箱",
            amount: "128",
            tone: "positive",
            status: "充足",
          },
          {
            primary: "货品 B",
            secondary: "仓库一 · 件",
            amount: "9",
            tone: "warning",
            status: "快没了",
          },
          {
            primary: "货品 C",
            secondary: "仓库二 · 箱",
            amount: "340",
            tone: "neutral",
            status: "压太久",
          },
        ],
        searchPlaceholder: "搜索货品名称或编号",
        filter: { kind: "状态", value: "快没了" },
      };

    case "tasks":
      return {
        title: "任务",
        subtitle: "谁负责什么、什么时候要交、做完没有。",
        columns: {
          primary: "任务",
          secondary: `负责${labels.staff}`,
          amount: "限期",
          status: "状态",
        },
        rows: [
          {
            primary: "上门量尺寸",
            secondary: `${labels.staff} A`,
            amount: "8月22",
            tone: "warning",
            status: "今天",
          },
          {
            primary: "出报价单",
            secondary: `${labels.staff} B`,
            amount: "8月24",
            tone: "neutral",
            status: "待办",
          },
          {
            primary: "订材料",
            secondary: `${labels.staff} A`,
            amount: "8月19",
            tone: "positive",
            status: "已完成",
          },
        ],
        filter: { kind: "状态", value: "待办" },
      };

    default:
      // Unreachable for catalogue keys -- every one of them is cased above and
      // industry-template.test.ts asserts it. Kept as a working page rather than
      // a throw: a customer's own system is the wrong place to discover a
      // missing switch arm.
      return {
        title: "新模块",
        subtitle: "下面的名称和栏位全部可以改成你要的。",
        columns: {
          primary: "项目",
          secondary: "说明",
          amount: "金额",
          status: "状态",
        },
        rows: [
          {
            primary: "记录 001",
            secondary: "示例内容",
            amount: "RM 0",
            tone: "positive",
            status: "已完成",
          },
          {
            primary: "记录 002",
            secondary: "示例内容",
            amount: "RM 0",
            tone: "warning",
            status: "处理中",
          },
          {
            primary: "记录 003",
            secondary: "示例内容",
            amount: "RM 0",
            tone: "neutral",
            status: "待处理",
          },
        ],
      };
  }
}

