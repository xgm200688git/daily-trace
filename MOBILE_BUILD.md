# Daily Trace PWA 构建和部署指南

## 概述

本文档说明如何将 Daily Trace v2 构建为 Progressive Web App (PWA)，使其可以在 iOS 和 Android 设备上安装到主屏幕。

## 前置条件

- Node.js 18+
- npm 或 yarn
- 现代浏览器（iOS Safari 16.4+、Android Chrome 等）
- HTTPS 服务器（PWA 安装要求 HTTPS）

## PWA 功能已配置

✅ **Web App Manifest**: `src/app/manifest.ts`
✅ **应用图标**: `public/icon-192x192.png`, `public/icon-512x512.png`
✅ **iOS 兼容性**: Apple 特定 meta 标签已在 `src/app/layout.tsx` 中配置

## 开发和测试

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 本地测试 PWA 功能

由于 PWA 安装需要 HTTPS，本地开发时可以使用：

```bash
npm run dev -- --experimental-https
```

这会在本地启动一个带有自签名证书的 HTTPS 服务器。

### 3. 在浏览器中测试

1. 打开浏览器访问 https://localhost:3000
2. 打开浏览器开发者工具（F12）
3. 进入 Application 或 Lighthouse 标签
4. 检查 Manifest 是否正确加载
5. 运行 Lighthouse PWA 审计

## 生产构建

### 1. 构建应用

```bash
npm run build
```

### 2. 启动生产服务器

```bash
npm start
```

## 部署到 HTTPS 服务器

PWA 必须通过 HTTPS 提供服务才能安装。以下是几种部署选项：

### 选项 1: Vercel（推荐）

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. Vercel 会自动部署并提供 HTTPS

### 选项 2: Netlify

1. 将代码推送到 GitHub
2. 在 Netlify 中导入项目
3. Netlify 会自动部署并提供 HTTPS

### 选项 3: 自定义服务器

确保服务器配置了有效的 SSL 证书（Let's Encrypt 等）。

## 在移动设备上安装

### iOS (iPhone/iPad)

1. 在 Safari 中打开应用的 HTTPS URL
2. 点击分享按钮（方框带向上箭头图标）
3. 向下滚动并点击「添加到主屏幕」
4. 确认应用名称，点击「添加」
5. 应用会出现在主屏幕上

### Android

1. 在 Chrome 中打开应用的 HTTPS URL
2. 点击菜单按钮（三个点）
3. 点击「安装应用」或「添加到主屏幕」
4. 按照提示完成安装
5. 应用会出现在主屏幕和应用抽屉中

## PWA 特性说明

### 当前已启用

- ✅ 主屏幕安装
- ✅ 独立显示模式（无浏览器地址栏）
- ✅ 自定义应用图标
- ✅ iOS 兼容性

### 可选增强

如需添加以下功能，可以进一步扩展：

1. **Service Worker（离线支持）**
   - 创建 `public/sw.js`
   - 配置缓存策略
   - 实现离线回退页面

2. **推送通知**
   - 生成 VAPID 密钥
   - 实现 Web Push API
   - 请求用户通知权限

3. **安装提示**
   - 监听 `beforeinstallprompt` 事件
   - 显示自定义安装按钮
   - 注意：iOS 不支持此事件

## 验证清单

部署后检查以下项目：

- [ ] 应用通过 HTTPS 提供服务
- [ ] Web App Manifest 可通过 `/manifest` 访问
- [ ] 所有图标文件可正常加载
- [ ] Lighthouse PWA 审计分数 &gt; 90
- [ ] 在 iOS 上可以添加到主屏幕
- [ ] 在 Android 上可以安装
- [ ] 以独立模式启动时无浏览器 UI
- [ ] 所有现有功能正常工作

## 故障排除

### iOS 上无法安装

- 确保使用 Safari 浏览器
- 确保通过 HTTPS 访问
- 检查 iOS 版本是否为 16.4+
- 尝试清除 Safari 缓存后重试

### Android 上无法安装

- 确保使用 Chrome 浏览器
- 确保通过 HTTPS 访问
- 检查 Manifest 是否配置正确
- 尝试清除 Chrome 缓存后重试

### Manifest 无法加载

- 检查 `/manifest` 路径是否返回正确的 JSON
- 验证 manifest.ts 中的图标路径是否正确
- 确认图标文件存在于 public/ 目录

## 参考资源

- [Next.js PWA 文档](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Web App Manifest MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [iOS PWA 指南](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Android PWA 指南](https://web.dev/articles/install-criteria)
