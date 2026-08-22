# 版式相似度审计 · 2026-08-22

创始人讲过三次「看起来真的没什么区别」。这份是量出来的答案,不是争出来的。

**结论:数字说十个都不一样,图片说八个里面有六个一样。两个都对。**

数字比的是 token 值 —— 没有两个版式共用同一个强调色、同一个底色、同一个疏密、
同一个阴影。图片比的是「一眼看过去像不像」,而一眼看到的是**重量**:

    border-card-width   0px x3、1px x5、2px x1
    shadow-raised       none 或 1-2px 的浮起,只有柔和是浮雕

疏密、颜色、圆角、字体四个轴都盖到了。**重量这个轴一个人都没碰。**
所以 2026-08-22 加的不是第十一个配色,是这个轴:粗野(brut)。

原始数据在下面。生成脚本没有留在 repo 里(它是一次性的),但方法很简单:
把每个 token 档的宣告抓出来,两两比对共享值的比例。

---


## 两两比较(共享 token 的百分比)

| 甲 | 乙 | 共享 | 不同的 token 数 |
| --- | --- | --- | --- |
| bare | blueprint | 77% | 28 |
| hearth | soft | 77% | 28 |
| bare | swiss | 76% | 29 |
| ledger | stamp | 76% | 29 |
| docket | ledger | 75% | 30 |
| contract | ledger | 72% | 34 |
| contract | stamp | 70% | 36 |
| blueprint | swiss | 68% | 38 |
| docket | stamp | 65% | 42 |
| blueprint | large | 64% | 43 |
| contract | docket | 63% | 44 |
| bare | large | 57% | 51 |
| large | swiss | 57% | 52 |
| contract | large | 53% | 57 |
| blueprint | contract | 52% | 58 |
| contract | swiss | 51% | 59 |
| docket | swiss | 51% | 59 |
| bare | contract | 50% | 60 |
| bare | ledger | 50% | 60 |
| blueprint | ledger | 50% | 60 |
| large | ledger | 50% | 60 |
| ledger | swiss | 50% | 60 |
| stamp | swiss | 49% | 61 |
| bare | stamp | 48% | 63 |
| blueprint | stamp | 48% | 62 |
| large | soft | 48% | 62 |
| large | stamp | 48% | 62 |
| bare | docket | 47% | 64 |
| hearth | large | 47% | 64 |
| bare | hearth | 46% | 65 |
| bare | soft | 46% | 65 |
| blueprint | hearth | 46% | 65 |
| blueprint | soft | 46% | 65 |
| contract | hearth | 46% | 65 |
| contract | soft | 46% | 65 |
| blueprint | docket | 45% | 66 |
| docket | large | 45% | 66 |
| hearth | ledger | 44% | 67 |
| ledger | soft | 44% | 67 |
| docket | hearth | 43% | 69 |
| hearth | stamp | 43% | 69 |
| hearth | swiss | 43% | 68 |
| soft | stamp | 43% | 68 |
| soft | swiss | 43% | 68 |
| docket | soft | 42% | 70 |

## 十个最像的一对,到底哪里不同


### bare vs blueprint — 共享 77%

差在这些轴上:

- **radius**: `4px 6px 8px 6px 999px`  vs  `6px 8px 12px 8px 999px`
- **border**: `0.5px 0px -`  vs  `0.5px 1px -`
- **accent**: `#18181b`  vs  `#2261dd`
- **canvas**: `#fbfbfc`  vs  `#f3f7fe`
- **card**: `#fbfbfc`  vs  `#ffffff`
- **type-scale**: `10.5px 14px 15px 21px -`  vs  `10.5px 13px 14px 21px -`
- **weights**: 一样 → 500 600 -
- **density**: `0px 8px 13px 20px 48px`  vs  `18px 8px 13px 14px 42px`
- **elevation**: `none 0 10px 30px -6px rgba(12, 24, 46, 0.20)`  vs  `0 2px 8px rgba(12, 24, 46, 0.09) 0 10px 30px -6px rgba(12, 24, 46, 0.20)`
- **tracking**: `-0.02em 0.09em`  vs  `-0.02em 0.02em`

### hearth vs soft — 共享 77%

差在这些轴上:

- **radius**: `10px 14px 20px 999px 999px`  vs  `14px 18px 26px 999px 999px`
- **border**: 一样 → 0.5px 0px -
- **accent**: `#237570`  vs  `#6272e0`
- **canvas**: `#faf6f0`  vs  `#eceef3`
- **card**: `#fffdf9`  vs  `#eceef3`
- **type-scale**: 一样 → 11px 13.5px 15px 23px -
- **weights**: 一样 → 600 700 -
- **density**: `22px 10px 18px 18px 52px`  vs  `24px 10px 18px 18px 54px`
- **elevation**: `0 2px 6px rgba(21, 50, 39, 0.09), 0 12px 28px -10px rgba(21, 50, 39, 0.16) 0 12px 40px -8px rgba(21, 50, 39, 0.22)`  vs  `9px 9px 20px rgba(43, 51, 69, 0.14), -9px -9px 20px rgba(255, 255, 255, 0.95) 14px 14px 34px rgba(43, 51, 69, 0.20), -10px -10px 26px rgba(255, 255, 255, 0.85)`
- **tracking**: 一样 → -0.012em 0.01em

### bare vs swiss — 共享 76%

差在这些轴上:

- **radius**: `4px 6px 8px 6px 999px`  vs  `0px 0px 0px 0px 0px`
- **border**: `0.5px 0px -`  vs  `0.5px 1px -`
- **accent**: `#18181b`  vs  `#d92b1c`
- **canvas**: `#fbfbfc`  vs  `#f4f4f5`
- **card**: `#fbfbfc`  vs  `#ffffff`
- **type-scale**: 一样 → 10.5px 14px 15px 21px -
- **weights**: 一样 → 500 600 -
- **density**: `0px 8px 13px 20px 48px`  vs  `18px 8px 13px 20px 46px`
- **elevation**: `none 0 10px 30px -6px rgba(12, 24, 46, 0.20)`  vs  `none 0 8px 28px -8px rgba(24, 24, 27, 0.24)`
- **tracking**: `-0.02em 0.09em`  vs  `-0.02em 0.12em`

## 每个轴上,谁跟谁撞


**radius** — 9 种不同的值 / 10 个版式
- 一模一样: **docket = swiss** → `0px 0px 0px 0px 0px`

**border** — 3 种不同的值 / 10 个版式
- 一模一样: **bare = hearth = soft** → `0.5px 0px -`
- 一模一样: **blueprint = contract = large = ledger = stamp = swiss** → `0.5px 1px -`

**accent** — 10 种不同的值 / 10 个版式
- 每个版式都不一样

**canvas** — 10 种不同的值 / 10 个版式
- 每个版式都不一样

**card** — 5 种不同的值 / 10 个版式
- 一模一样: **blueprint = contract = large = ledger = stamp = swiss** → `#ffffff`

**type-scale** — 6 种不同的值 / 10 个版式
- 一模一样: **bare = swiss** → `10.5px 14px 15px 21px -`
- 一模一样: **docket = ledger = stamp** → `10px 12px 13px 19px -`
- 一模一样: **hearth = soft** → `11px 13.5px 15px 23px -`

**weights** — 3 种不同的值 / 10 个版式
- 一模一样: **bare = blueprint = large = swiss** → `500 600 -`
- 一模一样: **contract = docket = ledger = stamp** → `500 650 -`
- 一模一样: **hearth = soft** → `600 700 -`

**density** — 10 种不同的值 / 10 个版式
- 每个版式都不一样

**elevation** — 10 种不同的值 / 10 个版式
- 每个版式都不一样

**tracking** — 8 种不同的值 / 10 个版式
- 一模一样: **blueprint = large** → `-0.02em 0.02em`
- 一模一样: **hearth = soft** → `-0.012em 0.01em`