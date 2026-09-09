# 三个行业：别人有、我们没有的（2026-09-10 深度研究）

> 他 2026-09-09 问：`真的不需要去用深度研究 看看还有没有一些基本的
> 还是一些额外的是没有写到的吗`
>
> **他问对了。** 我前一句讲「写完了」的依据是我们自己那三趟走查 ——
> 28 节 0 断。**而一趟走查只量得到我们自己想得到的东西**：
> 它证明的是「我们建的路都通」，不是「没有漏」。
>
> 做法：三个行业各一支，去读**别人自己的功能页跟说明文件**（不是排行榜文章），
> 先把我们已有的整份清单交给它，只回「他们有、我们没有」。
> 引的每一句都带原文跟网址。

---

## 🔴 零 · 四件是我们自己在替客户制造风险

**这一组排在最前面，因为它们不是「少一个功能」，是「我们做的东西会害到她」。**

### 1. 🔴 我们的官网产生器给医美诊所一块「客户评价」

马来西亚药物广告管制局（MAB 3/2023）的原文：
医疗机构的广告**要先经过核准**才能刊登，除非它「不涉及任何疾病的治疗、
预防或诊断的技术或服务」；而**病人见证（testimonial）「NOT ALLOWED」**、
网红／名人代言**「NOT ALLOWED」**、跟别的医师比价「NOT PERMITTED」、
机构之间比较「prohibited」。

🔴 **而一间医美诊所的官网上列出它做哪些疗程，本身就是一则受管制的广告。**
我们的 `site-composition.ts` 出的就是一块 testimonials，模版里出现 **44 次**。

对一个装修承包商，那是转换率。**对一间医美诊所，那是卫生部可以处理的一页，
而且是我们替她发布的。**

→ 要做的：**官网产生器对医疗类行业要有一个闸** —— 关掉见证跟前后对比那两块，
多一格放 KKLIU 核准编号。**一个旗标加一个过滤**，而外国那几家一个都没有做
（他们没有这条法规）。

### 2. 🔴 病历可以被就地改掉，而马来西亚的规矩不准

马来西亚医药理事会（MMC）病历指引原文：
「Erasure or 'blacking out' of entries already made … should be avoided.
If there are reasons for some corrections, the erroneous statement should be
neatly crossed out, **but still be readable**. The correction should then be
entered … **and signed clearly by the person making the correction**.」
每一笔要「record the Date, Time and the Procedure or Treatment, in
chronological sequence, and should be signed by the person making the entry」。

我们的 `treatment_notes` 是一张可以 `update` 的表。**在一场医疗投诉里，
一笔可以就地改掉的纪录，看起来就是被动过手脚的纪录。**

→ 要做的：`signed_at` · `signed_by` 两栏 · 签了之后拒绝改写 · 一张附注表。
仓库里 `sign_off` · `cosign` · `addendum` · `audit_trail` **全部是零**。
Aesthetic Record 把这一件当成一个有名字的产品在卖（Provider Room / MD Room）。

### 3. 🔴 肉毒是 B 类毒药，而我们的预约让美疗师接得下来

毒药法令 1952 第 19 条：只有**注册医生**可以出售、供应或施用该类毒药。
MMC 的美容医学指引允许美容师当「助手」，但医生「shall be vicariously and
totally liable for all untoward professional occurrences or adverse events」，
而且「shall not provide cover … for the independent aesthetic or cosmetic
practice of such unregistered persons」。

Zenoti 的原话：「Provider profiles store credential records — MD, NP, PA, RN,
aesthetician — each with defined treatment scope. **Booking rules by provider
type ensure only credentialed providers are visible for specific treatments.**」

→ 要做的：师傅表一栏（资格 ＋ 到期日）· 服务一栏（要哪一种资格）·
预约时一个守卫 · 到期进「快过期」那张名单。**很小，而仓库里一个字都没有。**
（行医执照 LCP 三年、APC 一年，两个都会过期。）

### 4. 🔴 未成年人：没有出生日期，就没有监护人签名

年龄法令 1971：未满 18 岁是未成年人，**她自己签的同意书没有效力**。
而青少年做暗疮、镭射在马来西亚是常规生意。

`date_of_birth` 跟 `photo_consent` 在仓库里都是**零个命中**。
Pabau 出的是一份**可以列印的 PDF 范本**（父母签名栏）—— 也就是说
**整个市场都只做到「印一张纸」**，没有人做成软件里的守卫。

→ 要做的：两栏 ＋ 一个同意书的变体。**很便宜，而它缺席的那一天很贵。**

---

## 一 · 沙龙

### 🔴 1. 染发的等待时间 —— 最贵的一件
一个染发是三段：上药 20 分钟 · **等 35 分钟（发型师是空的）** · 冲洗吹整 25 分钟。
Square 的原文把一个服务切成 `initial duration` / `processing duration` /
`final duration`，好让你「book a customer for a blow dry while another
customer's color treatment is developing」。Zenoti 同样。

**一个发型师一天四个染，空掉两个半钟头 = 三四个吹整 = 一天 RM120–200，
一个人一个月三千块。** 这一条比这张表上任何一件都值钱。

⚠️ **而它要改我们最强的那条守卫**：今天「同一个人同一个钟头不准撞」是
资料库层的排他约束挡死的，要改成**只在「真的在做」那几段冲突**。

### 🔴 2. 每个发型师不同价钱、不同时长
Fresha：「customize a service's cost and timing for specific team members or
locations… Clients will automatically see the price and duration when booking
with a specific team member.」
马来西亚几乎每一家都是这样定价（Ah Ming 剪 38，老板剪 68）。没有它，
老板要开「剪发（资深）」「剪发（初级）」两个服务，而那会弄坏底下每一张报表跟抽成。

### 🔴 3. 请假 · 午休 · 培训 —— 挡住一段时间
我们只有**固定班表**。今天要挡掉「Fara 请了 MC」只能去改她的永久班表，
然后记得改回来 —— 忘了就是客人来了没有人。
Fresha：「add lunch breaks, training, holidays or blocked time in seconds」。

### 🔴 4. 一次来做好几样，而且不同人做
洗的是学徒、剪的是师傅、一张单、一个时段。
今天一笔预约只有一个 `staff_id` —— 所以**抽成分不了**，而且时长永远是错的
（「剪发 30 分钟」其实连洗带护是 75 分钟，於是那一天排爆）。
→ 一张预约明细表。**这是这张清单上杠杆最大的一张表** —— 底下的加卖、
抽成拆分、染膏消耗全部挂在它上面。

### 🔴 5. 染膏用掉要从架上扣（back bar）
Zenoti 的原文：「**Retail stock and backbar stock are tracked separately, even
for the same product.** A shampoo sold from the retail shelf and a shampoo used
behind the chair deduct from different buckets」，而且「Shrinkage becomes
visible when retail sales and backbar usage don't reconcile」。

🔴 **我们有库存、有批号效期、有补货线 —— 而没有任何东西会消耗它。**
所以那几个讯号是在一组**上线三个月就跟现实脱节**的数字上叫。
（⚠️ 医美那一边我们做到了：疗程用料会自动扣、而且扣效期最早那一支。
**沙龙这一边没有。**）

### 🔴 6. 走单客人的轮位（turn / rotation）
Aoikumo（马来西亚的那一家）明写：「Set employee availability roster and
**set turns for customer servicing**」。
怡保的街边理发店大半是走单。没有它：讲不出「大概等 25 分钟」，
而且**轮到谁变成每天吵一次** —— 站在门口的那个拿到客人，也拿到抽成。
⚠️ Vagaro 没有这一件 —— 所以这是市场上一条真的分界线，不是人人都有。

### 其余（依序）
折扣／优惠券当成真的东西（Aoikumo 会「auto-allocation across cart items」，
因为抽成要算在 180 还是 144 上）· **小费**（Phorest 自动分给服务过她的每一个人）·
**到店状态**（waiting / in service —— 我们只有 booked/done/no_show/cancelled，
答不了「她到了没有」，而**这会喂坏我们的放飞机计数**）· 每个服务不同抽成率 ·
**染发配方留在客人卡上**（她的配方只在发型师脑袋里，那个发型师走了客人跟着走）·
固定周期预约（每两个星期的洗吹阿姨）· **客人自己改期／取消**（现在那条连结是只读的，
而**改不了的客人干脆不来** —— 我们的放飞机数字有一半是这样来的）·
每日结帐对数 · 套票共用／过期／跨店余额 · 集点 · 客人卡上的警示（PPD 过敏）·
**皮肤测试（patch test）带效期**（Fresha 六个月，而且**只警告不挡**，那个选择值得抄）·
会员月费 · 前后对比照 · 礼券带号码跟到期 · 结帐时问「要不要先约下一次」·
上下班打卡 · 收评价（**先私下问，好的才引去 Google** —— Aoikumo 的做法）。

---

## 二 · Medi spa（除了上面那四件法规的）

### 🔴 1. 一份有价钱、她会签的疗程方案
「六次镭射 ＋ 两支填充，四个月，RM 6,800，今天订金 RM 2,000」——
一份文件，送出去、签、然后变成一串预约跟一张收款表。
Zenoti：「Automatically generate treatment notes and **custom quotes** during or
after consultations, helping providers close more sales」。

🔴 **而挡路的东西很基本**：`beauty` 那一组页面是
`总览 · 客户 · 预约 · 收款 · 开销 · 师傅 · 库存 · 官网` ——
**没有报价单、也没有订单那一页。她今天开不出任何一张有明细有价钱的纸。**

### 🔴 2. 病史／禁忌，而且要在预约那一刻浮出来
过敏 · 正在吃的药 · 怀孕哺乳 · 抗凝血剂 · A 酸 · 蟹足肿 · 自体免疫 · 心律调节器。
MMC 指引要求医生「pay particular attention to exclude, through proper physical
examination and relevant investigations, any pathological or clinically morbid
conditions … before embarking on a procedure」。**投诉进到 MMC，「我们有口头问」
不是抗辩。**

⚠️ 而研究另外量到一件值得抄的：**「挡下预约」比想像中少见** ——
只有 Zenoti 跟 Phorest 会挡（而且挡的是「前置服务／皮肤测试」），
Fresha 明写它**不挡**。其余全部只是一面红旗，要人自己看。
→ 我们照 Fresha 那一条：**警告，不要挡**。挡住她开单，那一刻客人已经躺在那里。

### 🔴 3. 注射图 —— 脸上哪一点打了几个单位
Pabau 原文：「Mark injection sites directly onto a high-resolution face chart or
client photo — recording the product, units, batch numbers, and date within a
treatment note」。Aoikumo 也有（「anatomies such as skin or full body layout」）。
**我们已经有部位、产品、数量、批号 —— 缺的是那张图跟「一点一笔」的粒度。**
而这是这一类软件里**最看得见**的一格，每一家都放在首页。

### 🔴 4. 哪几个病人打了 X 批号 —— 召回那一句
Pabau 讲得最直白：「identify exactly which clients received a specific batch if
a product recall or adverse reaction occurs」。
🔴 **这是整张清单上最便宜的一件：一个查询、一页。资料我们全都有了。**
填充物在马来西亚是医疗器材法令 2012 下的管制品，召回是诊所自己的责任。

### 🔴 5. 照片同意书是另一份，而且要有范围、到期、可撤回
Pabau：「A general treatment consent form does not grant that permission.」
要写明：涵盖哪些照片 · 谁可以公开 · 送到哪些平台 · 每一种用途 ·
**到期日或到期事件** · 签名 ·「I may revoke this authorization at any time」。
→ 我们的同意书引擎已经在了，这是它的一个变体加三栏。
**而它跟上面第零组第 1 件是同一件事的两半**：她就算签了，那张照片在马来西亚
也多半不能公开用。

### 其余
不良事件／并发症当成自己一笔纪录（⚠️ **没有一家在卖这一件 —— 这是机会不是补课**）·
会员月费（跟套票不一样）· 合规仪表板（几张病历没签 · 谁没有同意书 · 谁的执照要到期）·
**病人自己的一页**（她最常问的是「我还剩几次」，而那今天是打电话问柜台；
我们的 `/c/<门牌>` 已经是这扇门的形状了）· 咨询当成一种独立的预约类型并且算转换率 ·
候补名单 · 疗程前后的注意事项**而且记下有没有发过** · 体重血压那一类数字 ·
**未兑现套票的负债表**跟**每一个疗程真正的成本** · 处方跟配药登记
（毒药法令第 24 条要一本处方簿；⚠️ 只管**带回家的药**，当场注射不在里面）·
**病人的国籍**（2025-07-01 起，非马来西亚人的私人医疗服务要收 6% 服务税 ——
我们的客户表没有这一栏，单据也没有读它的规则）。

---

## 三 · 补习中心

### 🔴 1. 补课要变成一堂欠着的课
缺席 → 欠一堂 → 家长约去别的班 → 没用掉会过期。
Jackrabbit 有整个子系统（「Makeup Settings … whether or not there is a time
limit」）；AOne（马来西亚）：家长可以「request replacement classes」，而且
「if the replaced class is credit-based, **student credit balance is consumed**」。
**这是马来西亚补习中心最常收到的那一则 WhatsApp**，今天活在老板脑袋跟一本簿子里。
一个月十堂没记的补课 ≈ 一个学生一整个月的学费。

### 🔴 2. 一个家长三个孩子一张单（家庭，不是客户）
Jackrabbit 整个资料模型是**家庭**：「Family Fixed Fees」、报名费可以
「Per Family… **with optional family maximum**」。
我们今天是三个客户、三张单、三条连结、一笔钱要手工拆。
🔴 **而兄弟姐妹折扣今天是一个人打进去的数字 —— 它不知道大的那个走了要停。**
帐龄也是坏的：一个欠 RM480 的家庭，在我们这里是三个不相干的欠款人。

### 🔴 3. 报名费 · 押金 · 教材费
第一张单从来不只是学费。**而押金不是收入，是欠家长的钱** ——
混在同一张单上，月底那个数字就是错的，退学退款那天也没有东西可以冲。
Jackrabbit 把它拆成三个工具（报名费 · 年费 · 非学费杂费），
而教材费的形状**跟我们那一按「全班开单」一模一样，只是费用类型不同**。

### 🔴 4. 学期（我们只有「月」）
没有学期就没有两件事：**「这四十个还没报下一期」**（补习中心一年最大的一笔钱），
跟**一月份全班升级**（今天要手工重打整个名册）。假期密集班也没有地方放。

### 🔴 5. 试听课
iEduCentre 把它放在第一位。试听不是入学，而**一个来试过、没有报名的**
是老板手上价值最高的一条跟进。→ 一个状态 ＋ 一个讯号，**不是子系统**，
而我们那台讯号机已经在跑十四种。

### 🔴 6. 学生自己撞堂 · 教室撞堂
我们只挡老师。今天没有东西挡住把 Ahmad 同时排进星期二五点的数学跟科学，
也没有东西挡住两班二十个人进同一间十五个位子的房。
**而学生那一条用的是挡老师那一条一模一样的查询。这是这张表上最便宜的红。**

### 其余
中途插班按比例算（我们那一按今天收整个月）· **请假有没有提前讲**
（Pike13 有一个「cut-off time」，而它正是「要不要补课」的前提）·
老师按钟点／按堂／按人头（**按人头那一种我们的点名资料算得出来**）·
预付课时包 · 候补名单 · 退学（通知日 · 最后一天 · 原因）·
家长那一页要能写（请假 · 约补课）· 成绩／评语／成绩单 · 作业 · 谁可以接孩子 ·
🔴 **老师的教学准证到期**（教育法令 1996 第 79 条；JPN 柔佛列明补习中心要
「PERMIT PENGELOLA (MINIMUM 3 ORANG)」跟「PERMIT MENGAJAR PT (MINIMUM 1 ORANG)」；
无准证经营罚 RM30,000 或两年监禁）—— **两栏加一个讯号，而没有一家竞品在做**。

---

## 四 · 两件我们已经领先，而没有人知道

1. **同意书在送出去那一刻把字句冻结**（snapshot）—— 研究读遍那十家，
   **没有一家的页面描述这件事**。我们做了，而且它是这一类争议真正的靶。
2. **批号 · 效期 · 效期最早的先出（FEFO）** —— Zenoti · Pabau · Aoikumo
   卖的就是我们已经有的东西。**demo 的时候要讲出来，这是平手不是落后。**

---

## 五 · 价钱的锚（他上门要知道的）

| 谁 | 价 | 含什么 |
|---|---|---|
| **Synorex**（补习） | **RM 990/年**（Basic）· **RM 2,990/年**（Pro，十家分行） | 含 LHDN 电子发票 · 家长端 · 薪资 · 作业 |
| **Aoikumo**（美容／医美） | **RM 2,680/年**起 · 美学 **RM 5,380/年** · 医疗美学 **RM 6,680/年** | 那 RM 1,300 的差价买的是「EMR ＋ 病假单 ＋ 处方 ＋ 药品批号效期」 |
| Aoikumo 电子发票 | **另收 RM 500/年/分店** | —— |

🔴 **我们年费 RM 1,500，而补习那边 RM 990 就买得到含电子发票的一整套。**
这不是叫我们降价，是**上门的时候要知道他会拿哪一个数字来比**，
而上面那几件红的就是他在那个价位上会发现我们没有的。

---

## 来源

**沙龙**：[Fresha 进阶定价](https://www.fresha.com/) · [Square 处理时间](https://squareup.com/help/us/en/article/6115) ·
[Zenoti 沙龙](https://www.zenoti.com/) · [Phorest 小费](https://www.phorest.com/) · [Aoikumo](https://www.aoikumo.com/)
**Medi spa**：[MMC 美容医学伦理指引](https://mmc.gov.my/wp-content/uploads/2025/09/Guideline-on-The-Ethical-Aspects-of-Aesthetic-Medical-Practice.pdf) ·
[MMC 病历指引](https://mmc.gov.my/wp-content/uploads/2025/09/Medical-Records-Medical-Reports.pdf) ·
[药物广告管制局 MAB 3/2023](https://pharmacy.moh.gov.my/sites/default/files/document-upload/advertising-guidelines-healthcare-facilities-and-services-mab-3.2023.pdf) ·
[Zenoti 医美](https://www.zenoti.com/medical-spa-software/features) · [Pabau 注射图](https://pabau.com/features/injection-plotting) ·
[Aesthetic Record 病历签核](https://www.aestheticrecord.com/chart-sign-off/) · [Aoikumo 价目](https://www.aoikumo.com/pricing/)
**补习**：[AOne](https://aone.com.my/) · [Synorex](https://synorex.group/tuition) · [iEduCentre](https://www.ieducentre.com/features/) ·
[Jackrabbit 补课](https://help.jackrabbitclass.com/help/settings-for-absences-makeups-in-parent-portal) ·
[Jackrabbit 报名费](https://help.jackrabbitclass.com/help/post-registration-fees) ·
[Teachworks 请假截止](https://www.teachworks.com/addons/customer-cancellations) ·
[JPN 柔佛 · 补习中心](https://sites.google.com/view/upsjpnjohor/perkhidmatan/permohonan-baharu/pusat-tuisyen)

⚠️ **没查实的，写下来不要当事实**：Zenoti 的说明中心对自动抓取一律回 403，
它那几句是从搜寻引擎的索引读到的，不是我自己打开那一页。
补习那边的电子发票门槛跟阶段我没有再验一次（[任务 136](./founder-tasks.md#136) 有）。
