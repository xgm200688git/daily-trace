# 中文双模块日记应用实施方案

---

## 📋 项目状态

### ✅ 已完成 (v1.0)

#### 摘要
- ✅ 单体 `Next.js App Router + TypeScript + Tailwind + SQLite` 单用户本地版，界面与文案全部中文
- ✅ 核心闭环：`记录 -> 日合并 -> 可选 AI 总结 -> 周报生成`
- ✅ 两段式自动化：每日/每周定时 + 打开应用补偿
- ✅ AI 可选增强，失败自动降级规则生成

#### 关键实现
- ✅ 数据模型：`entries` 表承载生活/工作记录
- ✅ `daily_records` 按日期+模块唯一，一天两条派生记录
- ✅ `weekly_reports` 从工作日报生成，支持模板和 revision
- ✅ `templates` 周报模板系统，默认四段式
- ✅ 支撑模型：`profile_settings`、`job_runs`
- ✅ 业务入口：Server Components、Server Actions、Route Handlers
- ✅ 自动化策略：定时 + 补偿 + 幂等
- ✅ 前端信息架构：生活、工作、报告三 Tab
- ✅ AI 方案：可选增强，规则兜底

#### 测试计划
- ✅ 单元测试覆盖：本地日期归档、模板校验、周报构建
- ✅ 集成测试覆盖：日合并过滤、周报 revision、幂等生成
- ✅ E2E 覆盖：生活记录、工作任务、周报生成 3 条链路
- ✅ QA 门禁：lint、typecheck、单测、集成测试全绿

---

## 摘要
- 采用单体 `Next.js App Router + TypeScript + Tailwind + Prisma + SQLite`，先做单用户本地版，界面与文案全部中文。
- 核心闭环固定为：`记录 -> 日合并 -> 可选 AI 总结 -> 周报生成`，不引入账号体系、消息队列、附件、协作等扩展能力。
- 自动化采用“两段式”：每日/每周定时任务负责正常产出，用户打开应用时执行补偿重算，确保漏跑后可恢复。
- 生成结果都是派生读模型，不是主数据；保存原始记录永远不依赖 AI，AI 失败时自动降级到规则生成。

## 代理分工
- `ProductAgent`：冻结 v1 范围，只做 Life、Work、Reports 三个主模块，不做登录、分享、附件、语音、富文本。
- `ArchitectAgent + DevOpsAgent`：搭建单仓单应用结构，根目录按 `src/app`、`src/features`、`prisma` 组织；定时任务统一走受保护的 Route Handler，并提供本地脚本验证。
- `DataAgent + BackendAgent`：定义表结构、应用服务、幂等规则和补偿逻辑；所有核心规则沉淀为纯函数，入口层只做编排。
- `FrontendAgent`：实现底部三 Tab 中文界面，移动端优先；生活侧强调快速输入，工作侧强调任务勾选，报告侧强调预览与一键生成。
- `AIAgent`：封装可选 OpenAI 适配层，只负责总结/润色/模板填充；规则引擎负责确定性输出和兜底。
- `QAAgent`：实现单测、集成、E2E 和发布门禁；首轮实现后自动做一次 QA 复盘并修正 P0/P1 问题。

## 关键实现
- 数据模型采用一个通用 `entries` 表承载两类输入：
  - `life` 条目保存 `occurredAt`、正文、可选标签/心情。
  - `work` 条目保存 `title`、`description`、`status`、`completedAt`；只有 `status=completed` 且 `completedAt` 落在本地日期内的任务才进入日报与周报。
- `daily_records` 设计为按 `日期 + 模块` 唯一，一天两条派生记录：
  - `life_daily_record`：按时间顺序合并当天生活记录，可附加 AI 总结。
  - `work_daily_record`：按完成时间汇总当天已完成任务，输出结构化 Markdown/JSON。
- `weekly_reports` 只从连续 7 天的 `work_daily_record` 生成，默认按 `ISO 周（周一到周日）`，保存 `revision`、`sectionsJson`、`contentMarkdown`、`generatorMode(rule|ai)` 和当前版本指针。
- `templates` 在 v1 仅支持周报模板，JSON 合同固定包含：`version`、`name`、`sections[]`；默认四段为 `已完成工作`、`成果亮点`、`问题阻塞`、`下周计划`，并允许新增自定义 section。
- 增加两个支撑模型：
  - `profile_settings`：单例设置，保存时区、周起始、AI 开关、默认模板。
  - `job_runs`：记录 `daily_merge`、`weekly_report`、`reconcile` 的幂等键、状态、错误和最后成功时间。
- 业务入口划分：
  - 页面读取走 Server Components。
  - 用户写操作优先走 Server Actions：新增/编辑生活记录、创建任务、切换完成状态、手动生成周报。
  - 平台触发走 Route Handlers：`/api/cron/daily`、`/api/cron/weekly`、`/api/reconcile`、模板导入导出。
- 自动化策略固定为：
  - 每日定时生成前一天的 `life/work daily record`。
  - 每周定时生成上一周 `weekly report`。
  - 每次打开应用先跑一次补偿，对缺失日期和缺失周做幂等补算。
- 前端信息架构固定为：
  - `生活`：快速输入框 + 当天时间线。
  - `工作`：任务快速创建、待办/已完成分组、大点击区勾选完成。
  - `报告`：今日生活日报、今日工作日报、本周周报预览、模板切换、一键生成/复制。
- AI 方案固定为可选增强：
  - 没有 `OPENAI_API_KEY` 或调用失败时，一律回落到规则拼接。
  - AI 只用于 `生活日报总结` 和 `周报模板填充/润色`，不参与原始记录保存和任务完成判断。

## 测试计划
- 单元测试覆盖：本地日期归档、工作任务完成过滤、日合并排序、周边界计算、模板 JSON 校验、AI 降级决策。
- 集成测试覆盖：Prisma 持久化、`daily/weekly` 幂等重跑、应用打开补偿、定时与补偿并发、模板驱动周报生成。
- E2E 至少覆盖 3 条链路：
  - 新增多条生活记录 -> 次日生成 `life_daily_record`。
  - 创建工作任务 -> 勾选完成 -> 进入 `work_daily_record`。
  - 连续 7 天有工作完成记录 -> 生成本周周报 -> 切换模板后重生成新 revision。
- QA 迭代门禁：
  - lint、类型检查、单测、集成测试、E2E 全绿后再做首轮验收。
  - 若发现 P0/P1 问题，先自动修复一轮再进入交付说明。

## 假设与默认值
- `单用户本地版` 视为无登录界面；“下次登录补偿”在 v1 中等价为“下次打开应用补偿”。
- 默认时区为 `Asia/Shanghai`，周定义采用 `周一到周日`；后续可配置，但 v1 先固定这套口径。
- v1 不支持附件、语音、手工编辑生成结果、多人协作、云同步；周报通过重生成形成新版本，不做富文本编辑器。
- 若后续需要部署到多实例云环境，保留接口与应用服务不变，只把 SQLite 替换为 Postgres。
