# 先问清货权与税务，再动工做点心订货系统

资料截至 2026 年 10 月 22 日。

**结论先说：** 你的设计，也就是把每家茶餐厅当成一张"桌子"、先付款再出单、一张订单同时出给代理和 HQ 两个地方，是餐厅扫码点餐行业里最成熟的做法，可以放心照搬。但市面上没有现成产品能装下你的价格链（RM100→70→80→90），也做不到"两边看到不同内容"，所以自己做有道理，前提是第一版做小。真正的风险不在技术，而在四件还没确认的事。第一，货从哪里发：从中国每单直发不现实（海运冷柜约 10 到 18 天，每批进口都要单独申请许可），所以 HQ 多半在马来西亚有库存，这必须向 HQ 确认。第二，点心含猪肉：Celsius Express 禁运含猪肉的冷冻食品，Ninja Cold 只收清真货，能用的冷链运输选择很窄。第三，你是"买来再卖"还是"替 HQ 收单赚佣金"，这决定谁开发票、收入怎么算、免电子发票的门槛怎么算。第四，"下单即付"茶餐厅是否接受，我没找到任何证据，而马来西亚同类平台正把 30 到 60 天赊账当卖点。付款手续费可以很低（FPX 每笔 RM1 到 3，比按百分比收费的网关便宜十几倍），难的是缺货后的部分退款。云打印机技术上走得通，但我没找到马来西亚本地经销商和价格，HQ 肯不肯放打印机也不知道，建议第一版先不买，用"HQ 订单页 + 可打印 PDF + 手机提醒"，确认 HQ 真的要纸再上打印机。

> **重要提醒：** 本报告里税务、法律、合规的部分只是"该去问谁、问什么"的提醒，**不是专业意见**，请以会计师和律师的意见为准。部分事实我没能核实，已在文中和第七节逐项标出。标"（未核实原页）"的内容，只看到搜索摘要，没有打开原网页，可信度较低。多数价格来自厂商自己的网页或广告，会变动。

## 一、把茶餐厅当"桌子"是成熟做法，但餐厅系统装不下你的价格链

餐厅扫码点餐行业的做法，和你的"茶餐厅 = 桌子"想法几乎一一对应。系统里有一条"桌子"记录，二维码只是指向这条记录的链接，从这个链接下的每张订单都绑定这张桌子，出票时桌号印在小票上 ([StoreHub](https://care.storehub.com/en/articles/9680165-qr-order-pay-1-what-is-the-complete-order-flow)；[Toast](https://support.toasttab.com/en/article/Setting-Up-Toast-Mobile-Order-and-Pay))。但两家都吃过"拿名字当钥匙"的亏：StoreHub 的桌名里带"#"号，二维码就会出错 ([StoreHub](https://care.storehub.com/en/articles/9684912-how-to-set-up-tables-and-qr-codes))，Toast 的桌号一改，印好的牌子就得重做。所以链接里应放一个不会变的编号，茶餐厅的名字只当显示文字。

先付款再出单也是主流。StoreHub 的"先付款"是默认流程，付款成功却没传到收银系统时会自动退款 ([StoreHub](https://care.storehub.com/en/articles/9680165-qr-order-pay-1-what-is-the-complete-order-flow))。Eats365 可以设"必须先付款""最低消费""数量上限""截单时间"，还能让新订单先停在"待接受"，店员点了接受，厨房才出票 ([Eats365 设置](https://support.eats365pos.com/scan-to-order/configure-scan-to-order-settings-full-service)；[Eats365 接单](https://support.eats365pos.com/manage-new-orders))。这个"先让代理看一眼再打印给 HQ"的步骤成本最低，对熟客可以改成自动通过。加菜（加单）的做法也现成：付过款的订单锁住，新增的东西另开一张单，只打印新增部分 ([StoreHub](https://care.storehub.com/en/articles/6379145-how-to-manage-incoming-qr-orders-on-pos))，正好对应"截单前再加几箱"。

餐厅系统里大部分防乱下单的招数，如会过期的二维码、桌上的验证码、必须店员先开桌，都是因为坐在店里的人是陌生人。StoreHub 把永久二维码的恶作剧风险评为"较高，拿到二维码的人都能下单"，Papaya 也直说桌码"不是万无一失" ([Papaya](https://help.papaya.co.th/en/articles/9215241-table-codes))。你的茶餐厅是认识的老客户，不需要这一整套。但"每家一个私人链接"本质上就是一个永久二维码，谁拿到谁就能进去。因为是先付款，陌生人乱下单亏的是他自己，真正的风险是别人看到你的价格表（见第二节）。我的建议是在链接之外加一道手机验证码（Toast 就是手机号加一次性验证码 ([Toast](https://support.toasttab.com/en/article/Toast-Mobile-Order-and-Pay-FAQs?lang=en_US))），再留一个"停用此链接"的按钮。这是我的建议，不是哪一家的现成做法。

餐厅系统有三处明显不适合你。其一，StoreHub 不支持部分退款，取消只能在当班当天、整单退 ([StoreHub](https://care.storehub.com/en/articles/6379145-how-to-manage-incoming-qr-orders-on-pos))，而你的货几天后 HQ 才发现缺一箱，需要的恰恰是按行退。其二，我没找到任何一家文档说明能把同一张单发到两个地方且内容不同，它们只能按品项分流到不同打印机。其三，它们支持的是店内局域网、USB、蓝牙打印机 ([StoreHub 打印机](https://care.storehub.com/en/articles/5727001-how-to-set-up-your-storehub-printer)，未核实原页)。马来西亚的 StoreHub、Qashier、Eats365、Klikit 都还在运营，月费大约 RM25 到 499，其中 StoreHub 的价格表是 2021 年的旧数据 ([StoreHub 比较表](https://www.storehub.com/my/blog/qr-ordering-system-comparison-malaysia)；[Klikit](https://klikit.io/en/learn/restaurant-pos-system-price-malaysia))。我没有实际测试任何产品，"装不下"是根据功能描述推断的。FeedMe 的创办想法就来自柔佛一家茶餐厅的手写点单，可见茶餐厅是被验证过的市场，但那是堂食，不是批发 ([Vulcan Post，赞助文章](https://vulcanpost.com/864658/feedme-pos-fnb-restaurants-malaysia/))。

再看批发订货平台。马来西亚最相关的有三家。Supplybunny 每个商品标"立即付款"或"询价"，页面有 WhatsApp 客服按钮 ([Supplybunny](https://www.supplybunny.com))。Borong 的买家最长可拿 60 天账期 ([Borong](http://www.borong.com/borong-direct/))。Food Market Hub 与 Funding Societies 合作，餐厅最长可延后 30 天付款 ([Malay Mail](https://www.malaymail.com/news/money/2023/04/19/food-market-hub-supplybunny-pioneer-embedded-financing-in-supplier-restaurant-transactions/65511))。它们都是多供应商市场，要抽佣，客户关系归平台，不适合当你的替代品（这是我的判断，资料没有直接讨论）。对你有用的教训有两条。第一，做得好的订货工具不强迫客户改习惯：Choco 把 WhatsApp、短信的订单转成供应商要的格式 ([Twilio 案例](https://customers.twilio.com/en-us/choco))，UnifyOrdering 把 App、WhatsApp、电话来的单收进同一个待确认队列 ([Xero 应用页](https://apps.xero.com/au/app/unifyordering))。所以你的后台需要"代茶餐厅下单"的功能，免得老板娘一通电话就绕开系统。第二，同行把赊账当卖点，而"下单即付"茶餐厅接不接受，没有任何资料能证明，这是整份研究里最大的未验证假设。另外，Stoqo 在 2020 年停业 ([DailySocial](https://news.dailysocial.id/post/stoqos-shutdown-and-survival-strategy-for-b2b-commerce))，Supplybunny 的餐厅生意在疫情初期跌了约 60% ([Digital News Asia](https://www.digitalnewsasia.com/startups/business-hit-covid-19-supplybunny-turns-pin-chart-rapid-growth))，都说明客户全是同一类行业的集中风险。你的客户全是茶餐厅，也有这个问题。

自己做和用现成工具的对比，要摆得公平一点。Shopify 基础版和 Grow 版（美国官网价每月 US$25 和 US$65）、或 WooCommerce 批发插件（每年 US$99 到 299）已经能做"登录才看价、统一一个批发价、最低订购量"，只是送货日和截单要另装插件，按客户单独定价要 Shopify 最贵的 Plus 版（US$2,300 起/月）([Shopify 价格](https://www.shopify.com/pricing)；[Shopify 功能表](https://help.shopify.com/en/manual/b2b/getting-started/plan-features)；[Wholesale Suite](https://wholesalesuiteplugin.com/pricing/))。它们做不到的，是你最在意的几样：同一张单出两种内容、RM70 和 RM80 互相保密、HQ 确认缺货、三方对账。自建就是为了这几样，其余能省则省。

**对你这个项目：** **照搬**客户编号绑订单、付款成功才通知 HQ、可选的"代理先确认"、加单当新单、最低金额和整箱限制、截单时间，再加一个餐厅系统没有的"重复上次订单"按钮和"代客下单"。**不照搬**匿名客人的防乱下单机制、单一价格表、"当班才能取消"的规则、并桌和分单。**要避开**拿店名当钥匙、只靠链接登录、第一版就把功能堆满。

## 二、RM80 要对 HQ 和茶餐厅同时保密，靠的是设计，不是把按钮藏起来

所有主流平台处理"不同客户不同价"的办法都一样：每个客户挂一张价格表，表里每个商品一个价，可加数量折扣和个别客户的特价。Shopify 在多张价格表重叠时取最低价，容易让人意外 ([Shopify](https://help.shopify.com/en/manual/b2b/catalogs))。你的情况简单，一客一表，加上"该客户该商品的特价"永远优先，不允许叠加，几张表就够了。"登录后才显示价格"在现成插件里只是页面显示设置 ([Barn2](https://barn2.com/kb/hide-price-from-logged-out/))，店主还在问怎么防别人从后台接口读到商品信息 ([Shopify 社区](https://community.shopify.com/t/disable-shopify-ajax-api/403761)，该帖没证明真的泄露)。自己做则简单得多：不设公开目录，由服务器在验证身份后只回传这一家的价格。发给茶餐厅的数据里根本不该出现 RM70 和 RM100。

下单当时，要把价格抄一份存进订单里（价格快照）：卖价 RM80、估计进货成本 RM70、HQ 当天目录价 RM100、返点百分比，订单确认后不能改，要改只能开"调整单"。Umbraco 就是这样冻结价格的 ([Umbraco](https://docs.umbraco.com/umbraco-commerce/10.latest/key-concepts/price-freezing))，Odoo 的成本和利润字段只给内部用户看 ([Odoo 源码](https://raw.githubusercontent.com/odoo/odoo/17.0/addons/sale_margin/models/sale_order_line.py))。按你的数字，每单位赚 RM10，是卖价的 12.5%，或进货价的 14.3%（我的计算）。注意，进货成本只是"估计"，因为 HQ 的目录价或返点会变，实际成本要等 HQ 发票对上才确定。谁能看什么，建议这样设计：

| 信息 | 代理（你） | HQ | 茶餐厅 |
|---|---|---|---|
| 品项、数量、送货地址 | 看 | 看 | 看 |
| HQ 目录价 RM100 | 看 | 看 | 不需要 |
| 你的进货价 RM70 | 看 | 可选（本来是 HQ 自己的价） | 绝不看 |
| 卖给茶餐厅的 RM80 | 看 | 绝不看 | 看 |
| 你的利润 | 看 | 绝不看 | 绝不看 |
| 茶餐厅的消费者价 RM90 | 备忘 | 绝不看 | 自己的 |

（此表出自调研笔记的推断，不是哪家的标准。）最干净的做法是让 HQ 根本不是你系统的用户：HQ 只收到一份专门生成的、没有价格的出货单，而不是一份被"遮住价格"的完整订单。这也是做代发货的卖家的常规做法：包裹里不放含价格的发票，否则成本和利润会被看穿 ([SellTheTrend](https://www.sellthetrend.com/kb/what-is-blind-dropship))。

价格泄露的路径有五条。包裹里的发票或装箱单、共用账号和导出文件、茶餐厅自己把价格表拿给 HQ 看、HQ 在合同里要求你报告零售成交价、公开的商品目录链接。第一、第二和最后一条可以靠设计解决；茶餐厅自己把价格表拿给 HQ 看，只能靠关系和合同来约束；HQ 要求你报告成交价，要靠谈判合同条款。还有一个你已经做出的决定带来的代价：HQ 直发给茶餐厅，HQ 就知道了你的客户是谁、地址电话是什么，绕过你直接供货的风险因此上升。这是商业问题，只能靠合同条款处理（见下一段的法律提醒）。

你的价格链和常见的"品牌最低广告价"（MAP）正好反过来：下游的价格（RM80、RM90）比 HQ 自己网上卖的 RM100 还低。品牌通常用最低价规定、减返点、自己直销来管住渠道 ([Foley & Lardner](https://www.foley.com/?p=114534))，所以 HQ 的反应是首要的商业风险。在马来西亚，转售价格维持不是当然违法，但竞争委员会（MyCC）对"最低转售价"态度强硬，建议价和最高价如果成了下游串通的参照点，也可能有问题 ([Conventus](https://conventuslaw.com/report/malaysia-antitrust-competition-guide-2016/))。更新的消息是，2026 年的竞争法修正案在 7 月底参议院通过，等待国家元首御准，据律师所评论，取消了"横向/纵向"协议的区分，纵向的定价协议风险因此上升 ([Baker McKenzie，2026 年 8 月](https://www.bakermckenzie.com/en/insight/publications/2026/08/malaysia-significant-competition-law-reforms-and-practical-implications))。御准和生效日期我没能确认。所以系统里不要做"强制茶餐厅卖 RM90"或"价格下限"之类的功能，最多放一个"建议零售价"的备忘栏，这类事都要先问律师。

如果 RM70 其实是"先付 RM100，之后返还 30%"，那它就是一笔向 HQ 的应收款，需要对账。国际会计准则（IAS 2）把进货返点算作降低存货成本 ([Forvis Mazars](https://forvismazars.com/th/en/insights/doing-business-in-thailand/accounting/rebates-related-to-the-purchase-of-inventory))，这篇文章讲的是泰国，马来西亚对应的准则我没核实，需问会计师。要证明这 30%，每笔进货应存：当天目录价及来源截图、返点比例及计算基础、HQ 订单号、发票和贷项单号、协议版本。返点如果是按"你买了多少"计算，而不是按"你卖了多少"，HQ 就不需要知道 RM80 （这是我的推断，没有马来西亚来源）。

**对你这个项目：** **照搬**一客一价格表、下单时存价格快照、订单确认后只能用调整单改、为 HQ 单独生成无价格出货单。**不照搬**多张价格表叠加、多币种、价格历史审计表这类大系统功能。**要避开**只在页面上隐藏价格、让 HQ 登录你的完整订单后台、包裹里放含价格的发票、任何强制转售价的功能。

## 三、货从 HQ 直发听起来简单，但猪肉、冷链和货权会先卡住它

"代理收单后转给供应商发货"在电商里有成熟流程。以 Shopify 为例：供应商收到发货请求，必须先"接受"或"拒绝"（可写原因，如缺货），接受后才能发货，可以分批发货，发货时回传物流公司和运单号。取消订单也只是"请求"，供应商可以拒绝，因为可能已经打包 ([Shopify 开发文档](https://shopify.dev/docs/apps/fulfillment/fulfillment-service-apps/manage-fulfillments))。对你最重要的一点是：**打印出来不等于 HQ 看见了**。打印机是单向通道，没有 HQ 一键回复"有货/缺货/已发货（附运单号或司机）"，系统分不清"打印了"和"处理了"（这是我的设计判断）。订单状态建议分开记三样：订单（已付款、HQ 已确认、缺货、已取消）、付款（未付、已付、已退）、送货（已发、已送达、有争议）。

和 HQ 结账时，批发代发货的惯例是每张订单一张供应商发票、账期如 30 天，零售商更愿意按批次合并结算 ([Practical Ecommerce](https://www.practicalecommerce.com/Drop-Shipping-How-to-Manage-Invoices))。无论 HQ 同意哪种方式，都要存下订单号、HQ 单号、下单/确认/发出的数量、RM70 的成本快照、运单、签收、索赔和贷项金额。一个常被忽略的点：钱是你收的，客人投诉时你就是对客户负责的一方，供应商给不给你补偿取决于合同 ([Dropshipzone](https://www.dropshipzone.com.au/blog/handling-customer-refunds-dropshipping))。所以 HQ 接受你索赔的期限，不应比你给茶餐厅的索赔期更短。你每箱只赚 RM10 左右，一两箱解冻的货就能吃掉很多单的利润。

冷冻运输是本调研里限制最多的一环。

| 选项 | 价格线索 | 速度和范围 | 含猪肉能运吗 | 要留意 |
|---|---|---|---|---|
| Celsius Express（经 EasyParcel） | 起价 RM29.70/件 | 巴生谷收件后下一个工作日，西马其他 2 至 3 天，仅限西马 | **禁止**含猪肉或猪油的冷冻食品 | 每件限 5、10、20 公斤三档；默认赔偿 RM200；没有电子签收 ([EasyParcel](https://easyparcel.com/my/couriers/celsius-express/celsius-express-city-frozen/)) |
| Ninja Cold | 未公布 | 1 至 3 个工作日，沙巴砂拉越除外 | **只收清真货** | 冷冻温度官方文章前后不一致（-18 至 -20 度，另一处 -15 至 -20 度）([Ninja Van](https://blog.ninjavan.co/en-my/redefining-cold-chain-logistics-ninja-cold-officially-launches-in-malaysia/)) |
| Lalamove 冷藏货车 | 2023 年资料：货车车费另加 RM100 至 120 冷藏附加费 | 西马 | 没查到 | 温度档是 1 至 15 度和 -15 至 0 度，不一定保证 -18 度 ([EasyParcel](https://blog.easyparcel.com/my/?p=75869)) |
| 一般快递 | | | | SPX 把冷冻食品列为禁运 ([SPX](https://spx.com.my/zh-Hans/prohibited-and-packaging.html))；J&T 没核实 |

结论是：含猪肉的商品大概率只能走 HQ 自己的冷藏车或愿意运猪肉的货运公司（这是推断，我没找到所有承运商的政策）。所以商品资料里要有一个"含猪肉"标记，用它决定哪些承运商可用。按件计费的冷链快递起价 RM29.70，而你每个单位只赚 RM10，所以最低订单金额或送货费几乎是必需的。参考行情：吉隆坡一家餐饮批发商的最低购买额是 RM200，限巴生谷内送货 ([Low Seat Hoong](https://lowseathoong.com/who-we-serve/))。谁付运费，本调研无从得知，要问 HQ。送货日和截单时间我没找到任何马来西亚冷冻批发商公开的规则，只找到 Celsius 的"中午 12 点前交件"，所以要做成可配置的（区域 → 星期几送货 → 几点截单），并建议你打电话问两三家同行。

从中国每单直发在时间上不现实：海运冷柜大约 10 到 18 天（货代广告数据，未核实原页）([vspeed](https://www.vspeed.asia/china-coldchain-to-malaysia))，进口肉类产品的许可是每批货一份 ([ChemLinked](https://food.chemlinked.com/foodpedia/malaysia-meat-product-regulation))。所以"HQ 直发"多半是 HQ 的马来西亚仓库发货，你提到仓库里要放打印机，也暗示了这一点。但这仍是我的推断，必须向 HQ 确认。点心和包点算不算"肉类产品"、要不要走兽医局和检疫局（DVS、MAQIS）的许可，调研没有答案，要看馅料是猪肉、鸡肉还是素。有一条新规要提前问 HQ：从 2027 年 3 月 1 日起，进口食品必须来自有卫生部认可的食品安全体系的厂房 ([ChemLinked](https://food.chemlinked.com/news/food-news/malaysia-introduces-food-safety-assurance-programme-for-imported-food))，所以要问 HQ 工厂有没有 GMP、HACCP 或 ISO 22000 证书。

冷冻货的索赔窗口很短。我找到的参考都是美国对消费者的卖家：解冻或漏液要求 4 小时内拍照，另一家给 24 小时 ([Hatch](https://www.hatch-green-chile.com/pages/spoiled-or-thawed-perishable)，未核实原页；[Big Texan](https://steaks.bigtexan.com/refund-policy)，未核实原页)。没有马来西亚批发商的标准。因为"解冻"事后无法证明，收货当下的检查最关键，建议让茶餐厅收货时在手机上点一下：数量对不对（逐行勾选）、拍纸箱外观和打开后的货、选"硬冻/变软/已解冻"，并提示"问题处理前不要丢弃或回冻"。承运商这边证据很少（Celsius 没有电子签收），你的系统可能是唯一的记录。

**对你这个项目：** **照搬**"HQ 接受或拒绝（含缺货原因）→ 分批发货 → 回传运单"的状态流程，取消当作请求，每张订单留完整成本快照。**不照搬**电商那套依赖 HQ 系统自动回传的做法，HQ 员工大概不用软件，现实的做法是仓库一键回复。**要避开**默认"打印了就等于处理了"、把含猪肉商品交给禁运的承运商、让 HQ 的索赔期短于你的承诺。

## 四、网上付款：手续费差十几倍，真正的难点是缺货后的部分退款

马来西亚的 FPX（网银转账）收费分两类：按每笔固定收（Billplz、ToyyibPay、CHIP，约 RM1 到 3）和按百分比收（Curlec、SenangPay、HitPay、Stripe）。以一张 RM1,000 的订单为例，你的利润约 RM125（RM80 单价，每单位赚 RM10，共 12.5 个单位），各家手续费占利润的比例如下（占比是我算的，费用以各网关页面为准，页面大多没写日期，且多数没说是否含 SST）：

| 网关 | 个人网银 FPX | 企业网银 FPX | RM1,000 单收费 | 占 RM125 利润 | 备注 |
|---|---|---|---|---|---|
| Billplz 基础版 | RM1.25 | RM3.00 | RM1.25 | 约 1% | 下一个工作日到账；有沙盒；回调带签名 ([Billplz](https://main.billplz.com/pricing)) |
| ToyyibPay | RM1.00 | RM2.00 | RM1.00 | 约 0.8% | 1 至 4 个工作日到账；文档较粗 ([ToyyibPay](https://www.toyyibpay.com/toyyibpay/pricing-plans)) |
| CHIP | RM1.00 | RM2.00 | RM1.00 | 约 0.8% | 无开户费月费；技术文档和退款流程我没核实 ([CHIP](https://www.chip-in.asia/pricing)) |
| Curlec 基础版 | 1.5%（最低 RM1） | 未核实 | RM15 | 12% | 开户费说法有 RM0/99/500/999 四种 ([Curlec](https://curlec.com/pricing)) |
| HitPay | 1.8% + RM0.40 | 未核实 | RM18.40 | 约 15% | 独资可用个人账户 ([HitPay](https://hitpayapp.com/my/pricing)) |
| Stripe 马来西亚 | 3% + RM1 | 资料未记载 | RM31 | 约 25% | 开发工具最好；FPX 5 个工作日到账 ([Stripe](https://stripe.com/en-my/pricing)) |

我的建议顺序是先试 Billplz 和 CHIP，ToyyibPay 当预算备选。ToyyibPay 的接口出错时也回"成功"，验证用的签名方式较弱，要多写防护 ([ToyyibPay 接口](https://toyyibpay.com/apireference/))。Curlec 对账资料最完整，每笔结算都有结算编号 ([Curlec](https://curlec.com/docs/payments/settlements/faqs/))，但按百分比收费。所有网关都要用你公司名下的账户收款，Billplz 要求银行户口是机构名字 ([Billplz](https://support.billplz.com/guide/create-account))，所以要用你公司的名义开，不要用董事个人账户（HitPay 对独资放宽）([HitPay](https://docs.hitpayapp.com/onboarding/requirements-my))。

谁能付、付得了多少，比手续费更影响你。FPX 本身的单笔上限不是问题（个人账户 RM30,000，企业账户 RM1,000,000），问题在付款人自己银行设的网银限额和账户类型 ([PayNet](https://knowledgebase.paynet.my/hc/en-us/articles/49684820949273-Frequently-Asked-Questions-FAQs)，未核实原页)。Maybank 的 FPX 据说只开放个人网银客户，不开放独资和小商家 ([Maybank](https://www.maybank2u.com.my/maybank2u/malaysia/en/personal/faq/accounts_and_banking/financial_process_exchange_fpx.page)，未核实原页)，所以独资茶餐厅的老板可能得用私人户口付，有限公司要走企业网银，而企业网银的付款要授权人批准，最长 7 天 ([Fiuu](https://fiuu.com/fpx-fpx-b2b/))。DuitNow QR 的限额由付款人的银行或钱包决定，有的低到 RM200 到 1,000 ([Merchantrade](https://help.mtradeasia.com/hc/en-us/articles/47086939384857-What-is-the-maximum-amount-that-I-pay-via-DuitNow-QR))，不适合当大单的主要方式。因此系统要有"待付款"状态（最长可达 7 天，要设订单过期和占货规则），并且必须以网关发来的"付款成功通知"为准，不能只信付款后跳回来的页面。Billplz 的通知 20 秒内没收到回复会重发最多五次 ([Billplz 接口](https://support.billplz.com/api))，所以同一个通知来多次也要只处理一次。

退款是真正的难点。FPX 在银行网络层面不能撤销，Billplz 的做法是"你向客户的银行账户转账"，需要收集客户的银行资料并预存一笔转账额度 ([Billplz 退款](https://support.billplz.com/guide/issue-a-refund))。Stripe 能做 FPX 部分退款（60 天内），但需要 14 天到 6 周 ([Stripe](https://docs.stripe.com/payments/fpx))。SenangPay 据说不支持 FPX 退款 (未核实原页)，ToyyibPay 没找到退款接口。而你最常遇到的恰恰是部分退款：缺一箱。我的建议（没有来源，是常规商业做法）：缺货和短装默认走"下次订单抵扣额度"或贷项单，只有整单取消才走真银行退款，银行退款先走人工流程。收到钱后要立刻对账：Billplz 的 FPX 下一个工作日结算，但是整批打款，对账靠下载 Excel 报表 ([Billplz 对账](https://support.billplz.com/guide/reconcile-your-payout))。所以你自己的"每单账本"（收款、手续费、退款、净额）比网关报表更重要，对账的最终对象是应付 HQ 的钱，而不是网关余额。

另外两个提醒。一是对熟客，业界常见的替代是银行转账加唯一参考号，或 JomPAY（每个客户一个参考码）(未核实原页)；赊账只给审核过的老客户，风险由你承担。二是关于马来西亚小型餐饮供应商究竟怎么收款（现金、转账、支票、30 天账期），我没找到 2024 至 2026 年的资料，只有 2017 年政府调查说多数公司给 30 天账期，部分中小企业等了长达 94 天才收到钱 ([SME Corp](https://smecorp.gov.my/images/SME_Weekly_News/2017/Nov_2017/SME_Weekly_News_6_Nov_2017_-_10_Nov_2017.pdf))。这个问题只能靠你去问十来位老板。

**对你这个项目：** **照搬**餐厅系统的"付款成功才出单、出单失败自动退"、每笔订单带唯一编号方便对账。**不照搬**餐厅"整单退、当班退"的规则。**要避开**把 DuitNow QR 当大单主通道、只信跳转页面不信服务器通知、用百分比收费的网关（手续费会吃掉 12% 到 25% 的利润）、以董事个人名义开网关账户。

## 五、云打印机技术上走得通，但第一版不必先买

真正"打印机自己来你的服务器取单"的标准有两个，文档齐全且仍在更新：Star CloudPRNT 和 Epson Server Direct Print。前者是打印机每隔几秒问你的服务器"有没有单"，有就取走，打完回报；后者类似 ([Star 协议说明](https://star-m.jp/products/s_print/sdk/StarCloudPRNT/manual/en/protocol-guide.html)；[Epson](https://download4.epson.biz/sec_pubs/pos/reference_en/technology/server_direct_print.html))。Epson 马来西亚官网列出的 TM-m30III 内置这项功能，但没写价格 ([Epson 马来西亚](https://www.epson.com.my/For-Work/Printers/POS-Printers/Epson-TM-m30III-Thermal-Receipt-POS-Printer/p/C31CK50302))。中国的云打印（飞鹅云、商米、汉印）是"你调用厂商接口、厂商转给打印机"的做法，价格便宜，但我无法确认它们在马来西亚的 SIM 卡、网络和售后，商米那份对接文档还是 2019 年的 ([飞鹅 SDK](https://pkg.go.dev/github.com/houseme/feie)；[商米](https://m.sunmi.com/en/80-kitchen-cloud-printer))。PrintNode 和 QZ Tray 需要每个地点放一台常开电脑，和"HQ 不想装任何东西"冲突 ([PrintNode](https://printnode.com/en/pricing))。

和你选的 Vercel + Supabase 配合没有问题：打印机每次来问都是一个很短的请求，服务器查一下数据库的待打印队列就回答。Star 默认每 5 秒问一次，按此算每台机一天约 17,280 次请求（我的计算），冷冻订单不需要这么快，15 到 30 秒就够了，但各型号允许的间隔没有核实。要注意 Vercel 免费版的定时任务一天只能跑一次，"打印机几分钟没来问就改发手机提醒"的检查，可改用 Supabase 的每分钟定时任务 ([Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing)；[Supabase](https://supabase.com/docs/guides/functions/schedule-functions))。我没找到现成的 Next.js 对接范例，所以这部分得自己写，工作量不大，但没有人踩过路。

实际运行中会出的问题，资料里都有提到。Star 打完回报的"确认"信号可能丢失，导致重复打印，所以票上应印订单号和"重印"字样，并且同一张票只处理一次 ([Star](https://star-m.jp/products/s_print/sdk/StarCloudPRNT/manual/en/protocol-reference/http-method-reference/job-confirmation-delete/index.html))。Epson 纸用完时状态是"空"，不会打印，需要提醒仓库换纸 ([Galley](https://support.galleysolutions.com/cloud-printers-epson-epos-cloud-setup))。部分打印机只支持 2.4GHz 的 Wi-Fi。官方的示范服务器明说不考虑安全 ([示例](https://github.com/mr-yum/cloudprnt-sdk))，所以每台打印机要有自己的密钥。中文最容易乱码，多篇论坛讨论都是打印机内置的字码表问题 ([QZ Tray 议题](https://github.com/qzind/tray/issues/285))，最稳的做法是把票面先做成图片再打印（我的推断，慢一点但不会乱码），买回来第一件事用真实的中文品名试印。

在马来西亚的实际购买情况不乐观。Lazada、Carousell 上有大量 RM110 到 420 的 80mm 局域网小票机，如 Xprinter XP-N160II 约 RM225 到 335，但这些是店内联网打印机，不是会自己取单的云打印机，要在每个地点再放一台常开的小电脑去转接 ([Lazada](https://www.lazada.com.my/products/xprinter-xp-n160ii-pos-80mm-thermal-receipt-printer-wall-mounted-lan-port-auto-cut-network-printer-compatible-with-loyverse-ipad-android-storehub-ios-pos-app-i507268493.html))。Star 我没找到马来西亚经销商，美国零售价约 US$328 到 375 ([Spartan POS](https://spartanpos.com/collections/star))；Star 的保修条款写的是美国和加拿大，无线网卡模块写明仅限北美 ([Star](https://starmicronics.com/product/mc-print3-pos-receipt-printer-retail-kitchen-online-ordering/))，所以要买有线网口的型号或走本地渠道。调研没有查汇率、税和运费，所以我只能说落地价应该明显高于 RM1,000 一台（推断）。

打印内容不同这件事，我没找到任何收银系统的文档支持，必须自己做：一张订单对应多个"打印任务"，每个任务用各自的模板生成，代理版有价格和利润，HQ 版只有茶餐厅名字、地址、电话、品项、数量，价格数据根本不进入 HQ 的数据里，比事后遮挡可靠。备用方案（邮件、WhatsApp）也要用 HQ 的模板生成。WhatsApp 的单条费用各家资料不一致（RM0.0564 对 US$0.014 对 US$0.0086），要查 Meta 官方价目表 ([ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/malaysia/))。

所以打印机放第一版还是第二版？我的建议是第二版，理由有三：HQ 愿不愿意放打印机还是未知数；打印机是单向通道，反正还需要 HQ 的确认按钮；买两台、配网、试中文、处理缺纸掉线，工作量不小。第一版可以做"HQ 订单页（无价格）+ 一键打印的 A4 版 + 手机提醒"，系统里先把"打印任务"和两套模板的结构设计好。跑两到四周，如果 HQ 仓库每天都在打印这份单，并要求自动化，再买一台 HQ 的试点。如果 HQ 坚持第一天就要纸，建议先只买一台，经 Epson 马来西亚渠道买，先试中文。

**对你这个项目：** **照搬**"打印机来取单"的方式、每台机各自的密钥、打印前先付款成功、"重印"功能、掉线告警。**不照搬**厂商的云端（中国云服务的海外支持未核实）、餐厅的"按品类分打印机"逻辑。**要避开**第一版就买两台打印机、把打印当作确认、不试中文就批量采购、让 HQ 版模板带出任何价格字段。

## 六、合规提醒：几个数字刚变过，答案取决于你是"买卖"还是"代理"

**再次提醒：** 这一节只是整理出"该问会计师、律师、报关行的事"，不是税务或法律意见。我读到的是官方指南 v4.8（2026 年 8 月 30 日发布）和常见问题解答（2026 年 9 月 4 日更新），而官网列出的特定指南已更新到 v4.9（2026 年 9 月 7 日），我没读到 v4.9 全文，引用的条文编号可能已变。

**电子发票（MyInvois）。** 你给的资料里的"RM100 万豁免门槛"已经过时。官方指南写明年营业额低于 **RM300 万**的纳税人可以豁免 ([LHDN 指南 v4.8，1.6.1(e)](https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf))，新闻引述税局说法称从 2026 年 9 月 1 日起生效，指南文字本身没有印生效日 ([The Star](https://thestar.com.my/news/nation/2026/08/30/over-11-million-businesses-to-benefit-from-higher-e-invoicing-threshold-says-lhdn))。此前的门槛曾是 RM50 万，2025 年 12 月报道调到 RM100 万 ([Airwallex 博客，已被取代](https://www.airwallex.com/en-my/blog/e-invoicing-exemption-malaysia-rm1-million))，所以网上新旧说法并存。要特别小心一个陷阱：如果你的公司有营业额达 RM300 万的非个人股东、母公司、关联公司或合资方，豁免就不适用 ([指南 1.6.10](https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf))。若 HQ 或 HQ 的关联公司持有你的股份，就会触发这一条。豁免的企业不必开电子发票，但 HQ 这类大企业仍要开给你，茶餐厅也可能向你要 ([LHDN 常见问题](https://www.hasil.gov.my/wp-content/uploads/lhdnm-e-invoice-general-faqs.pdf))。如果不豁免：单笔超过 RM10,000 的交易、以及付给代理/经销商的款项，原则上不能合并开票，第四阶段（营业额至 RM500 万）有放宽期到 2027 年 12 月 31 日 ([特定指南 v4.7](https://www.hasil.gov.my/wp-content/uploads/irbm-e-invoice-specific-guideline.pdf))。已验证的发票 72 小时后不能改，只能开贷项单、借项单或退款单 ([指南 2.3.6](https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf))，所以你的账本应把发票当"不可修改的文件"，更正另开新文件。系统现在就该在茶餐厅资料里留好栏位：法律实体类型（独资/有限公司/合伙）、税号（TIN）、公司或身份证号码、注册地址、送货地址、SST 号码（可空）、收发票邮箱；买家税号只需在开户时验证一次并保存，官方也建议这样做 ([SDK](https://sdk.myinvois.hasil.gov.my/einvoicingapi/01-validate-taxpayer-tin/))。起步用免费的 MyInvois 网页（手填或 Excel 批量上传）就够，不急着做自动提交。

**你是"买卖"还是"代理"，是最关键的一个问题。** 在佣金代理模式下，是卖方（HQ）开发票给茶餐厅，再向你开"自我开具"的发票记录佣金；在买卖模式下，你开给茶餐厅，HQ 开给你 ([特定指南 v4.7 第 9 节](https://www.hasil.gov.my/wp-content/uploads/irbm-e-invoice-specific-guideline.pdf))。"不放库存"并不决定你是哪一种，合同由谁和茶餐厅订立、谁承担货物和收款风险才决定（我的推断）。这也影响账：买卖模式收入是 RM80、成本 RM70；纯代理收入可能只算 RM10 佣金，这会让"是否超过 RM300 万"的计算大不相同（需问会计师）。另外，如果你的系统被看作"电子商务平台"，指南规定平台要承担供应商角色开发票 ([特定指南 14.4.2](https://www.hasil.gov.my/wp-content/uploads/irbm-e-invoice-specific-guideline.pdf))，单一代理自己的订货网站算不算平台，不清楚，要问。

**销售及服务税（SST）。** 我没找到任何官方资料把冷冻点心或包点归入具体税号和税率，所以这是向会计师和报关行要问的。货物销售税主要落在制造商和进口商身上，2025 年 7 月起税率为 5% 或 10%，基本食品多数仍免税 ([Grant Thornton](https://www.grantthornton.com.my/globalassets/1.-member-firms/malaysia/publications/tax-2025/tax-alert---sales-tax.pdf)；[财政部](https://mof.gov.my/portal/en/news/press-release/revision-to-the-expanded-sales-tax-and-service-tax-take-into-account-public-and-industry-feedback))。纯转售商大概率不是销售税纳税人，但这只是我的读法，没有海关的确认。风险更可能在上游：进口那一方付的销售税会进入你的 RM70 成本。要问清楚的是：你如果对茶餐厅收配送费或平台费，是否算应税服务；你有没有做分装、重新贴标之类可能被当作"制造"的动作。

**进口与标签。** 谁是进口商（Importer of Record）要问清楚，进口商要登记食品安全信息系统（FoSIM），肉类产品每批货要申请检疫许可，清真证书要由 JAKIM 认可的机构发出，进口食品标签通常要印进口商的名称和地址（搜索摘要，未核实原页）([ChemLinked](https://food.chemlinked.com/foodpedia/malaysia-meat-product-regulation)；[ChemLinked 清真](https://food.chemlinked.com/expert-article/decoding-the-regulatory-framework-for-imported-halal-foods-in-malaysia))。含猪肉商品不在强制清真之内，但我没找到非清真肉品的进口与标签规则。商品资料里应有：含猪肉、是否清真及证书、进口商、生产厂和批号，系统里不要对没有证书的商品写"清真"。

**个人资料（PDPA）。** 2025 年起个人资料保护法分三批生效：处理资料的外包方（包括软件和主机公司）直接负责安全，资料外泄要在 72 小时内通报，指定资料保护主任的门槛是超过 2 万人（敏感资料超过 1 万人），你大概率达不到 ([Legal 500](https://legal500.com/developments/thought-leadership/countdown-to-compliance-personal-data-protection-amendment-act-2024-in-force-starting-1-january-2025)；[DLA Piper](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/))，但小公司是否仍要指定负责人，来源说法不一，要问律师。跨境传输的"白名单"已取消，改为看对方法律是否"实质相似"，而你用的 Vercel 和 Supabase 服务器很可能在国外，这条也问律师。实用做法：开户时给一份简单的隐私说明，只收必要资料（除非开电子发票需要，否则不收身份证号），资料加密、按角色授权。

**记录保存。** 税务局的公开裁定要求公司保存记录至少 7 年，而且放在马来西亚的注册办公室或营业场所 ([LHDN PR 4/2000](https://www.hasil.gov.my/wp-content/uploads/PR4_2000_Rev.pdf))。这条出自一份修订于 2010 年的旧文件，是否容许只放在国外云端，要问会计师，稳妥做法是保留一份可导出的本地备份。"只追加、不覆盖"的账本设计本身与这些规定是吻合的。

**其他。** 2018 年的《物价管制及反暴利法》规定的"不合理高利润"测试适用于所有商品和服务，你的约 14% 加价看起来风险低，但现行规则和节日限价名单我没能核实，列入问律师清单 ([Rahmat Lim](https://www.allenandgledhill.com/perspectives/news/price-control-and-anti-profiteering-mechanism-extended-to-all-goods-and-services-in-malaysia))。你替 HQ 收款是否需要国家银行（BNM）的批准，资料里没有明确答案：如果你是卖方，收的是自己的货款，一般属于正常买卖（推断，需律师确认）；如果你是替 HQ 代收再转交，情况更接近"代收他人资金"，可能应该改用网关的分账功能或让 HQ 自己开商户账户 ([BNM](https://www.bnm.gov.my/financial-services-act-2013-and-islamic-financial-services-act-2013)；[Billplz 接口](https://support.billplz.com/api))。我没查到你开公司、地方政府营业执照、食品场所登记的具体要求，这些要问公司秘书和地方政府。

**对你这个项目：** **照搬**官方推荐的做法：开户时存好买家税号、发票不可改、记录保存 7 年。**不照搬**网上说的"RM100 万豁免"。**要避开**在没问清楚前就自动生成发票、就写"清真"、就把资料放到国外而不问。

## 七、哪些事实没核实、哪些资料互相矛盾

下面是调研笔记里明确记下的缺口和冲突。你做决定时请当作"未知"处理，不要当作已确认的事实。

| 事项 | 状况 | 怎么处理 |
|---|---|---|
| 电子发票豁免门槛 | 官方指南写 RM300 万；生效日（2026 年 9 月 1 日）只来自新闻引述；旧资料有 RM50 万、RM100 万；特定指南 v4.9 没读 | 以会计师确认为准 |
| 竞争法修正案 | 2026 年 7 月 27 日参议院通过，等御准；后续状态没查到 | 问律师是否已生效 |
| 马来西亚点餐平台价格 | StoreHub 价格表是 2021 年的；FeedMe 有 RM90 和 RM39 两种说法；Qashier 页面无日期 | 只当参考 |
| 没找到或存疑的厂商 | Ordermate、MenuKaki、MyMenu、Mimos 找不到；FoodZaps 可能已停；Slurp 只有第三方列表；Lapasar、Food Market Hub 2026 年状态没确认 | 不要依赖这些 |
| 网关费用 | Curlec 开户费四种说法，且页面写"18% GST"（马来西亚没有 GST）；CHIP 的 DuitNow 费率有 1.0% 和 1.6% 两种，退款费页面前后不一；多数页面没说是否含 SST | 书面向网关确认 |
| 银行/FPX 限额 | Maybank 不开放独资、PayNet 限额均来自搜索摘要；没有"哪家银行让独资用企业网银"的清单 | 问你的茶餐厅客户用什么户口 |
| 冷链 | Ninja Cold 温度前后矛盾；Lalamove 温度档不到 -18 度；EasyParcel 两篇文章对 Celsius 覆盖范围说法不同；各承运商对猪肉的政策多数没查到；没有马来西亚冷链报价 | 逐家书面询价和确认 |
| 云打印机 | 没找到马来西亚本地的 Star、商米、飞鹅经销商和价格；Epson 马来西亚页面无价格；汇率、税、运费没查；商米文档是 2019 年的 | 先问 Epson 马来西亚 |
| 肉品进口规则 | 全部来自二手资料（ChemLinked 等）；点心包点算不算"肉类产品"没有答案；规则 3B 的指南全文要登录 | 问 HQ 及报关行 |
| 茶餐厅付款习惯 | 没有任何独立资料；也没有关于华人茶餐厅老板用 WhatsApp、微信还是电话的资料 | 做客户访谈 |
| 价格和费用时效 | 所有费用都截至 2026 年 10 月 22 日，厂商随时可改 | 开户前再查 |

## 结论

这轮调研改变了问题的重心：最难的不是二维码、打印机或网页，而是 HQ 合同里的几句话。RM70 到底是发票价还是事后返点、你是买卖还是代理、货是不是在马来西亚、谁是进口商、含猪肉的货谁能运，这几个答案会同时改变系统怎么记账、怎么开发票、怎么退款、要不要打印机。餐厅行业提供了很好的"管道"，但它们的假设（陌生客人、一张价格表、几分钟内出餐、整单退款）正好是你的生意不具备的。另一个容易被忽略的发现是：打印不等于确认，退款路径也比手续费更重要。这两件事如果不在第一版里设计好，缺一箱货就会变成要人工处理的纠纷。

所以工作顺序应该倒过来：先花一两周问清 HQ、会计师、律师（见文末清单），同时找五到十家茶餐厅聊聊付款习惯；然后做第一版时，只做"餐厅系统做不到"的那几样。

## 附一：建议的第一版精简范围

这是我根据调研做的建议，不是调研直接给出的结论。

**第一版建议做：**

1. 每家茶餐厅一个私人链接（链接里放编号，不放店名），首次用手机验证码，后台可随时停用；
2. 一张价格表（只显示 RM80，登录后才由服务器回传），按整箱下单，设最低订单金额；
3. 送货日和截单时间做成可配置（区域 → 星期几 → 几点截单）；
4. 下单即付：FPX 个人和企业两种网银都支持，以网关的付款成功通知为准，先接 Billplz 或 CHIP 中的一个；有"待付款"状态和过期规则；
5. 付款成功后：手机提醒代理；HQ 订单页（无价格）和一键打印的 A4 版出货单；HQ 一键回复"确认有货/缺货/已发货（附运单号或司机）"；
6. 订单行里存价格快照（RM80、估计成本 RM70、目录价 RM100、返点%），确认后不可改，只能开调整单；
7. 代理后台：订单列表、利润（只有你能看）、付款对账（网关编号加订单号）、应付 HQ 的账、"代茶餐厅下单"；
8. 缺货和短装先用"下次订单抵扣额度"处理，真银行退款先走人工；
9. 收货核对：茶餐厅在手机上点数量对不对、拍照，设索赔时限（几小时由你决定）；
10. 商品资料有"含猪肉""清真及证书""进口商"栏位；茶餐厅资料有实体类型、税号、注册号、地址、SST 号栏位；
11. 内部先建好"打印任务"表和代理版、HQ 版两套模板，打印机以后接上就能用。

**第一版先不做：** 云打印机（见第五节的触发条件）、自动提交电子发票、赊账和月结、定期订单、多级价格表、销售员 App、与 HQ 系统对接、所有"强制转售价"类功能。

**打印机的决定：** 建议放第二版。触发条件是 HQ 仓库连续两到四周每天都在打印那份 A4 单，并要求自动化；那时先买一台给 HQ 做试点，先试中文，再决定要不要买第二台给自己。

## 附二：你要先弄清楚的问题（按优先级）

再次提醒：税务、法律、合规相关的问题，答案以会计师、律师为准，本报告只是提醒。

| 优先级 | 要弄清的问题 | 问谁 | 为什么重要 |
|---|---|---|---|
| 1 | RM70 是开发票时就按 70 折收，还是先付 RM100 事后返还 30%？返点按"你买多少"还是"你卖多少"算？目录价会不会变、谁承担变动？ | HQ、会计师 | 决定是否有应收款和对账；返点按买入量算，HQ 就不必知道 RM80 |
| 1 | 你和茶餐厅的合同是你自己的（买卖），还是 HQ 的（你只收单赚佣金）？ | 律师、会计师 | 决定谁开发票、收入是 RM80 还是 RM10、免电子发票的门槛怎么算 |
| 1 | HQ 的马来西亚公司有没有提前进口并存货？谁是进口商？HQ 马来西亚公司是否在 MyInvois 系统上？ | HQ、律师、报关行 | 决定标签、许可、税，也决定"直发"是否现实 |
| 1 | 商品里哪些含猪肉？不含猪肉的有没有清真证书？ | HQ | 决定能用哪些承运商、商品标记和标签 |
| 1 | 谁来送货、怎么送、保证多少度？运费谁付？送货日、截单、最低订单是什么？ | HQ | 决定最低订单金额、截单规则、能否承诺送货日 |
| 1 | HQ 肯不肯接受一台打印机？仓库员工实际会用什么（打印机、平板、WhatsApp、纸）？谁来点"确认"？ | HQ | 决定打印机放第一版还是第二版 |
| 1 | HQ 同意看到茶餐厅名称、地址、电话吗？合同里有没有不得绕过你直接供货的条款？HQ 有没有要求你卖固定价？ | HQ、律师 | 绕过风险；固定转售价可能触及竞争法（2026 年修正案状态也要问） |
| 2 | 缺货、短装、解冻、送错，各自谁负责、谁赔？HQ 接受索赔的期限比你给茶餐厅的更短吗？贷项单怎么抵扣？ | HQ、律师 | 钱是你收的，你先对客户负责 |
| 2 | 你的公司是否符合电子发票豁免（年营业额低于 RM300 万，且没有 RM300 万以上的股东或关联公司）？收入按总额还是净额算？谁开发票给茶餐厅？用哪个分类代码？ | 会计师 | 决定要不要做发票功能；关联公司条款是陷阱 |
| 2 | 冷冻点心的税号（HS code）和进口销售税；你收的送货费、平台费是否应税；你有没有被视为"制造" | 会计师、报关行 | 影响 RM70 成本和你的收费设计 |
| 2 | 收茶餐厅的钱用哪家公司的账户收？要不要分开账户？退款、拒付由谁承担？替 HQ 代收是否牵涉 BNM 规定？ | 会计师、律师 | 网关开户名要与收款公司一致 |
| 2 | 茶餐厅愿意下单即付吗？习惯现金、转账还是赊账？老板用个人户口还是公司户口？用 WhatsApp、微信还是电话？ | 你的茶餐厅客户（访谈 5 至 10 家） | 本调研找不到任何证据；这是最大的未验证假设 |
| 3 | 网关书面确认：FPX 企业网银支不支持、限额多少；部分退款流程和费用；结算对账资料；收费是否含 SST | 候选网关（Billplz、CHIP） | 页面信息不全或互相矛盾 |
| 3 | 个人资料：隐私说明怎么写、服务器在国外是否可行、是否需指定负责人；记录需不需放在马来西亚 | 律师、会计师 | 你用的 Vercel 和 Supabase 很可能在国外 |
| 3 | 公司注册的营业范围、地方政府营业执照、不碰货的代理是否需要食品场所登记 | 公司秘书、地方政府 | 本调研没有找到可靠来源 |
| 3 | 如果买打印机：哪个型号、在哪里买、保修多久、能否正确打中文、2.4GHz Wi-Fi 还是网线 | Epson 马来西亚、经销商 | 马来西亚本地价格和保修都没查到 |
