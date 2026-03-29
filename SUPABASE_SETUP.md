# Supabase 配置完整指南

## 概述

本指南将帮助您配置 Supabase，实现 Daily Trace 在 Vercel 上的数据持久化、多用户支持和云同步功能。

---

## 第一步：创建 Supabase 项目

1. 访问 https://supabase.com 并注册/登录账号
2. 点击 **"New Project"** 创建新项目
3. 填写项目信息：
   - **Name**: `daily-trace`（或您喜欢的名字）
   - **Database Password**: 设置一个安全的密码（请保存好！）
   - **Region**: 选择离您最近的区域
4. 点击 **"Create new project"** 并等待项目创建完成（通常需要 1-2 分钟）

---

## 第二步：获取 Supabase 凭证

项目创建完成后：

1. 在左侧菜单中，进入 **Settings** → **API**
2. 复制以下信息：
   - **Project URL**: 类似 `https://xxxxx.supabase.co`
   - **anon public**: API Key

---

## 第三步：配置数据库 Schema

1. 在左侧菜单中，进入 **SQL Editor**
2. 点击 **"New query"** 创建新查询
3. 打开项目中的 `supabase_schema.sql` 文件
4. 复制该文件的全部内容
5. 粘贴到 Supabase SQL Editor 中
6. 点击 **"Run"** 执行脚本

---

## 第四步：配置 Vercel 环境变量

### 方式一：通过 Vercel Dashboard 配置（推荐）

1. 打开 Vercel Dashboard，进入您的 `daily-trace` 项目
2. 点击 **"Settings"** → **"Environment Variables"**
3. 添加以下环境变量：

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. 点击 **"Save"** 保存
5. **重要**：需要重新部署项目才能使环境变量生效！

### 方式二：通过命令行配置

在项目根目录创建 `.env.local` 文件（用于本地开发）：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 第五步：重新部署

1. 在 Vercel Dashboard 中，进入项目的 **"Deployments"** 页面
2. 点击最新部署旁边的 **"..."** 菜单
3. 选择 **"Redeploy"**
4. 等待部署完成

---

## 验证配置

部署完成后，测试以下功能：

1. **注册账号** - 访问应用并注册新账号
2. **登录** - 退出后重新登录
3. **切换模块** - 在生活、工作、报告模块间切换
4. **创建记录** - 添加一些生活记录和工作任务
5. **刷新页面** - 确保数据保存正确

---

## 数据库表说明

Supabase 数据库包含以下表：

### 认证相关
- `users` - 用户账号信息
- `sessions` - 用户会话信息

### 应用数据
- `profile_settings` - 用户设置
- `templates` - 报告模板
- `entries` - 日记和任务记录
- `daily_records` - 日报记录
- `weekly_reports` - 周报记录
- `job_runs` - 定时任务记录
- `sync_status` - 同步状态
- `change_queue` - 变更队列
- `conflict_history` - 冲突历史

---

## 故障排查

### 问题：仍然显示 "Invalid credentials"

**解决方案**：
1. 确认环境变量已正确配置
2. 确认已重新部署项目
3. 检查 Supabase 数据库中是否有 users 表
4. 在 Supabase SQL Editor 中运行 `SELECT * FROM users;` 查看数据

### 问题：数据库表未创建

**解决方案**：
1. 重新在 Supabase SQL Editor 中运行 `supabase_schema.sql`
2. 检查是否有错误信息
3. 确认所有表都已创建

### 问题：其他错误

**解决方案**：
1. 查看 Vercel 部署日志
2. 查看浏览器控制台错误
3. 确认 Supabase 项目状态正常

---

## 安全建议

1. **不要提交 .env 文件** - 已在 .gitignore 中配置
2. **定期轮换 API Key** - 在 Supabase 设置中可以重新生成
3. **配置 RLS 策略** - 为生产环境配置行级安全策略
4. **使用强密码** - 为 Supabase 数据库设置强密码

---

## 下一步

配置完成后，您将拥有：

✅ 完整的多用户支持  
✅ 数据持久化存储  
✅ 云同步功能  
✅ 在 Vercel 上稳定运行  

享受您的 Daily Trace 应用！🎉
