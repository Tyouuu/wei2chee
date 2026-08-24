# 任务 — 他交办的事，做完划掉

由 CLAUDE.md 引入，每次开会话自动读进来。
`分成一个是任务 一个是重点`——**这份是任务。重点在 [founder-points.md](./founder-points.md)。**

规则：
- 他每讲一件事，**立刻写进来**，不要等做完才写。
- **他没有新指示的时候，从「进行中」最上面拿一件继续做**（`我没说什么的时候 你也可以自己去执行`）。
- 做完的移到底下「已完成」，写上日期，不要删 —— 他要看得到做了什么。

---

## 进行中（由上往下做）

### 2. 补「一屏能放的东西」（六件差别里最要紧的）
这五类是所有风格共用的，补一次全部变厚。
- [ ] **KPI 卡排** StatRow（图标底块 + 大数字 + 涨跌 + 对比说明）
- [ ] **图表卡**（TrendChart 升级成真正的卡：标题、分段控制、网格、端点）
- [ ] **分组侧栏**（分组标题 + 图标 + 徽章 + 底部用户卡）—— RailNav 已支持，是种子没用
- [ ] **表格工具条**（筛选分段 + 计数）
- [ ] **顶栏 TopBar**（面包屑 + 搜索 ⌘K + 通知红点 + 头像）
- [ ] 每一个都要接 useRegisterVariant，且**不可以设 Puck defaultProps**（那会让风格永远抢不到）

### 3. 首页种子 3 个区块 → ≥ 8 个
`buildDashboard` 现在只吐 rail + PageHeader + HeroCard + WorkflowStrip + RecordTable。
- [ ] 第一屏不许留空

### 4. 新增两套风格
- [ ] **仪表盘**（Tabler 41.5k / AdminLTE 45.6k / ngx-admin 25.7k 方向）
- [ ] **中台**（Ant Design Pro 38.7k / vue-element-admin 90.2k 方向）
- [ ] **柔和**拿 Art Design Pro 改厚（不新增）

### 5. 编辑器要做到 Durable 那样，再加我们自己的
> `我觉得我们跟durable的编辑器还是有点差别 我要的完全是durable的那种编辑器
> 然后再结合我们的一点的设计还是更多功能进去 这样就可以形成我们独有的编辑器了
> 我需要你100%的去对照 然后去研究给我加强的方向`（2026-08-25）

- [ ] **100% 对照**：把 Durable 编辑器每一个操作实拍下来（进入、选中、改字、换款式、加区块、换页、发布、手机版），
      跟我们的编辑器同一个动作并排
- [ ] 列出差在哪 —— 不是列功能表，是**一步一步的操作对比**
- [ ] 提出加强方向，并且做成 demo（不是文字建议）
- [ ] 我们要比它多的部分：22 套版式 + 25 配色 + AI 出的是**他自己的系统**不是模板

### 6. 上游检查 `npm run check:upstream`
- [ ] 清单记住：从哪个 repo、拿了什么、拿的是哪个 commit、什么许可
- [ ] 脚本比对上游有没有新 release / 新 commit

### 7. 官网第一屏加产品截图
外面六个里六个都有（Linear / Attio / Stripe / Resend / Raycast / Polar），我们没有。

---

## 已完成

- **2026-08-25** — **砍风格 22 → 16 做完了。** 砍掉素 bare、清 clear、契约 contract、单据 docket、麻 grain、牛皮 kraft。
  迁移写进 migration（bare→swiss、clear→large、contract→ink、docket→ledger、grain→blueprint、kraft→signboard），
  **没有人会开到空白页**。清的 7:1 灰字 + 52px 触控并进了大字（大字原本的灰字只有 4.9:1，实测）。
  147 个测试全绿、tsc 干净、check:registers 16/16 结构互不相同。
  另外把 playwright 装成正式依赖（原本三个脚本把路径写死在 npx 缓存里，换台机器就断），
  新增 `npm run shoot:registers` —— 一键拍全部版式拼成对照表，把「用眼睛看」变成机制。

- **2026-08-25** — 判完他发的 18 张截图 / 20 个项目：2 个能搬代码（shadcn-admin、next-shadcn-admin-dashboard，都 MIT 同栈）、
  1 个能搬主题变量（vue-vben-admin）、8 个只能拿长相、9 个不用。
  做成三个现场渲染的 demo（仪表盘 / 中台 / 柔和商务）+ 视觉审计：
  https://claude.ai/code/artifact/ebd4da00-3e05-4f23-96a7-04fa6f70ed16
- **2026-08-25** — 建立这两份档案并接进 CLAUDE.md，每次开会话自动读。
