# 每日轨迹 (Daily Trace)

一个支持生活记录、工作任务、日报合并和周报生成的中文日记应用。

## 技术栈

- **框架**: Next.js App Router (16.2.1)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: SQLite (原生实现，非 Prisma)
- **测试**: Vitest (单元/集成) + Playwright (E2E)
- **AI**: OpenAI API (可选增强)
- **Android**: Capacitor 原生壳，可生成 APK

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

建议使用 Node.js 22.12 或更高版本。本项目使用 Node 原生 SQLite 和 `--env-file-if-exists`。

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

## 手机端安装

本项目提供 PWA 安装能力，可在手机上添加为独立应用使用。

### 本机局域网试用

```bash
npm run dev:mobile
```

手机和电脑连接同一个网络后，在手机浏览器访问电脑的局域网地址，例如 `http://电脑IP:3000`。

### 正式安装体验

- Android Chrome：使用 HTTPS 部署地址打开应用，浏览器会出现安装入口，也可以从页面右上角“安装到手机”触发。
- iPhone Safari：使用 HTTPS 部署地址打开应用，点击分享按钮，选择“添加到主屏幕”。
- 本地 HTTP 仅适合开发调试；真实安装、剪贴板、Service Worker 和离线缓存建议使用 HTTPS。

### 离线说明

PWA 版本会缓存基本壳层和离线提示页。需要完全离线使用时，请安装下面的 Android APK 版本。

## Android 原生离线版

项目已接入原生 Android 离线实现，可生成 APK/AAB。安装包启动后使用 Android 本机 SQLite 数据库，生活记录、工作任务、日报合并和周报生成都在手机本地完成，不依赖 Next.js 服务端或网络。

### 环境要求

- Node.js 22.12 或更高版本
- JDK 21
- Android SDK command line tools
- Android SDK `platforms;android-36`、`build-tools;36.0.0`、`platform-tools`

### 构建环境变量

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

### 构建 debug APK

```bash
npm run apk:debug
```

生成文件：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

如果连接了 Android 手机并开启 USB 调试，可以直接安装：

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 长期分发 release 包

本仓库已支持正式签名构建。签名材料放在本机，不进入 Git：

```text
android/key.properties
android/keystores/daily-trace-release.jks
```

构建可直接分发的 APK：

```bash
npm run apk:release
```

生成文件：

```text
android/app/build/outputs/apk/release/app-release.apk
```

构建应用商店更推荐的 AAB：

```bash
npm run aab:release
```

生成文件：

```text
android/app/build/outputs/bundle/release/app-release.aab
```

发布后更新同一个应用必须继续使用同一份 keystore，并递增 `android/app/build.gradle` 里的 `versionCode`；展示给用户的版本号修改 `versionName`。如果丢失 `daily-trace-release.jks` 或其密码，就无法给已安装用户推送同包名升级。

### 发布前检查

```bash
npm run apk:release
npm run aab:release
apkanalyzer manifest permissions android/app/build/outputs/apk/release/app-release.apk
apksigner verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
```

当前 release APK 已确认没有 `android.permission.INTERNET` 权限；应用数据保存在 Android 应用私有 SQLite 数据库中。

### 当前 Android 版限制

- Android 原生版与 Web/PWA 版使用不同数据库；两边数据不会自动同步。
- 目前没有云同步、账号体系、附件和富文本编辑器。
- 若需要上架应用商店，请优先提交 AAB，并按平台要求补充隐私政策、应用截图和分级信息。

## 脚本说明

| 脚本                | 说明                          |
|-------------------|-----------------------------|
| `npm run dev`     | 启动开发服务器                      |
| `npm run dev:mobile` | 绑定 `0.0.0.0`，便于手机通过局域网访问 |
| `npm run build`   | 构建生产版本                      |
| `npm run start`   | 运行生产版本                      |
| `npm run android:sync` | 同步 Capacitor Android 原生工程 |
| `npm run apk:debug` | 生成 Android debug APK |
| `npm run apk:release` | 生成已签名 Android release APK |
| `npm run aab:release` | 生成已签名 Android release AAB |
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
