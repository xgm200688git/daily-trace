# 🚀 Daily Trace - Vercel 部署超级详细指南

## 重要提示：关于数据库

⚠️ **注意**：本项目使用 SQLite 数据库。在 Vercel Serverless 环境中：
- SQLite 数据库文件无法持久化存储（每次部署后数据会重置）
- 要实现数据持久化，建议配置 Supabase（项目已内置支持）

## 恭喜！您已经完成了前期准备工作！

✅ Git 分支 `feature/auto-deploy` 已创建并推送到 GitHub  
✅ Vercel 配置文件 `vercel.json` 已添加  
✅ 项目在本地构建和运行正常  
✅ 数据库配置已更新以支持 Vercel 环境  

现在让我们完成最后的部署步骤！

---

## 📋 方法一：通过 Vercel Dashboard 部署（推荐，最简单！）

### 第一步：打开 Vercel Dashboard

1. 在浏览器中访问：https://vercel.com/dashboard
2. 确保您已经登录（您说已经登录了！）

### 第二步：导入项目

1. 点击页面上的 **"Add New"** 或 **"New Project"** 按钮（通常在右上角或页面中央）
2. 在 **"Import Git Repository"** 区域，您会看到您的 GitHub 仓库列表
3. 找到 **`xgm200688git/daily-trace`** 仓库
4. 点击仓库旁边的 **"Import"** 按钮

### 第三步：配置项目（大部分使用默认值即可！）

在项目配置页面，您会看到以下选项，请按以下设置：

| 配置项 | 推荐设置 | 说明 |
|--------|----------|------|
| **Project Name** | `daily-trace` 或您喜欢的名字 | 这将是您应用的子域名 |
| **Framework Preset** | ✅ Next.js | Vercel 会自动检测，不要改！ |
| **Root Directory** | ✅ `./` | 保持默认，不要改！ |
| **Build Command** | ✅ `npm run build` | 保持默认，不要改！ |
| **Output Directory** | ✅ `.next` | 保持默认，不要改！ |
| **Install Command** | ✅ `npm install` | 保持默认，不要改！ |

### 第四步：选择分支（重要！）

在 **"Git"** 区域或 **"Branch"** 下拉菜单中：

1. 点击分支选择下拉框
2. 选择 **`feature/auto-deploy`** 分支（这是我们刚创建的新分支！）
3. 确认选择正确

### 第五步：环境变量（可选）

在 **"Environment Variables"** 区域：

- 如果您有 `.env` 文件中的环境变量（如 `OPENAI_API_KEY`），可以在这里添加
- 如果没有，可以跳过这一步，应用有默认值

### 第六步：开始部署！

1. 检查所有设置确认无误
2. 点击页面底部的 **"Deploy"** 按钮（通常是蓝色的大按钮）
3. 等待部署完成（通常需要 1-3 分钟）

### 第七步：庆祝！🎉

部署完成后，您会看到：
- ✅ 绿色的 "Ready" 状态
- 🎉 您的应用 URL（类似 `https://daily-trace-xxx.vercel.app`）
- 点击链接即可访问您的应用！

---

## 📋 方法二：使用 Vercel CLI 部署

如果您更喜欢命令行方式：

### 第一步：登录 Vercel

在终端中运行：
```bash
npx vercel login
```

然后按照提示选择登录方式（推荐用 GitHub 登录）

### 第二步：部署项目

在项目目录中运行：
```bash
npx vercel
```

然后按照提示回答问题：
- `Set up and deploy ~/Documents/codex/Daily Trace?` → **Yes**
- `Which scope do you want to deploy to?` → 选择您的账号
- `Link to existing project?` → **No**
- `What's your project's name?` → `daily-trace`（或自定义）
- `In which directory is your code located?` → `./`（直接回车）
- `Want to modify these settings?` → **No**

### 第三步：部署到生产环境

测试部署成功后，运行：
```bash
npx vercel --prod
```

---

## 🎯 部署完成后

部署成功后，您可以：

1. **访问应用**：打开 Vercel 提供的 URL
2. **设置自定义域名**：在 Vercel Dashboard 的项目设置中添加
3. **配置环境变量**：在项目设置中添加需要的环境变量
4. **开启自动部署**：以后推送到 `feature/auto-deploy` 分支会自动部署！

---

## ❓ 常见问题

**Q: 部署失败了怎么办？**
A: 查看 Vercel Dashboard 中的部署日志，通常会有详细的错误信息

**Q: 如何更新部署？**
A: 只需向 `feature/auto-deploy` 分支推送新的提交，Vercel 会自动重新部署！

**Q: 可以部署 main 分支吗？**
A: 当然可以！在配置时选择 `main` 分支即可

---

## 📞 需要帮助？

如果遇到问题，请检查：
1. GitHub 仓库连接是否正常
2. 分支选择是否正确（`feature/auto-deploy`）
3. 构建命令是否正确（`npm run build`）

祝您部署顺利！🎉🚀
