# 每日轨迹 (Daily Trace)

一个支持生活记录、工作任务、日报合并和周报生成的中文日记应用。

## 技术栈

- **框架**: Next.js App Router (16.2.1)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: SQLite (原生实现，非 Prisma)
- **测试**: Vitest (单元/集成) + Playwright (E2E)
- **AI**: OpenAI API (可选增强)

## 核心功能

### 生活模块
- 快速输入生活记录
- 可选心情和标签
- 当日时间线展示

### 工作模块
- 快速创建任务
- 待办/已完成分组
- 大点击区一键勾选完成

### 报告模块
- 今日生活日报预览
- 今日工作日报预览
- 本周周报生成（支持自定义模板）
- 周报历史版本管理
- 一键复制功能

### 自动化特性
- 打开应用自动补偿缺失的日报/周报
- 幂等生成机制（相同输入不重复生成）
- 定时任务支持（/api/cron/daily 和 /api/cron/weekly）
- AI 失败自动降级到规则生成

## 快速开始

### 1. 环境配置

```bash
# 复制环境变量示例
cp .env.example .env

# 编辑 .env 文件配置所需变量（可选）
vim .env
```

### 2. 初始化数据库

```bash
npm run db:init
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 http://localhost:3000 即可使用。

## 脚本说明

| 脚本                | 说明                          |
|-------------------|-----------------------------|
| `npm run dev`     | 启动开发服务器                      |
| `npm run build`   | 构建生产版本                      |
| `npm run start`   | 运行生产版本                      |
| `npm run lint`    | 运行 ESLint 检查                |
| `npm run typecheck` | 运行 TypeScript 类型检查            |
| `npm test`        | 运行单元和集成测试                   |
| `npm run test:watch` | 运行测试观察模式                    |
| `npm run test:e2e` | 运行 E2E 测试                   |
| `npm run db:init` | 初始化数据库                      |
| `npm run db:reset` | 重置数据库                      |
| `npm run cron:daily` | 运行每日定时任务（本地验证）              |
| `npm run cron:weekly` | 运行每周定时任务（本地验证）              |

## 项目结构

```
src/
├── app/              # Next.js App Router
│   ├── page.tsx      # 主页面 (Server Component)
│   ├── actions.ts    # Server Actions (用户写操作)
│   └── api/          # Route Handlers
├── features/         # 业务逻辑模块
│   ├── ai/           # AI 增强
│   ├── diary/        # 生活/工作记录 CRUD
│   ├── merge/        # 日合并逻辑
│   ├── reconcile/    # 补偿重算
│   ├── reports/      # 周报生成
│   ├── settings/     # 用户设置
│   └── templates/    # 模板管理
├── components/       # UI 组件
└── lib/             # 工具库
```

## 注意事项

1. **数据库**：本项目使用原生 SQLite 实现，而非 Prisma ORM，这是前期项目执行过程中的必要调整
2. **环境变量**：`.env` 中的变量均为可选，应用有合理默认值
3. **AI 功能**：需要配置 `OPENAI_API_KEY` 才能启用 AI 增强，否则自动使用规则生成
4. **单用户版**：v1 为单用户本地版，无需登录

## 许可证

MIT
