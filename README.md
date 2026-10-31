# paseo-qoder-usage

Paseo plugin: Qoder and Qoder CN account quota (Credits) in the sidebar plus a detail screen with configurable auto refresh.

- Shows every logged-in site: Qoder CN and/or Qoder international, each in its own card with an independent refresh button
- Sidebar footer row: each site's combined credits (plan + add-on + organization resource package)
- Screen: plan info, credits progress bars with 80%/95% warning colors, quota-exceeded notice, manual refresh
- Auto refresh: off / 5m / 15m / 30m / 1h / 6h / 24h
- Update check: a banner appears at the top of the quota screen when the registry listing has a newer version (reads only the public registry record and the pinned package.json; no user data is sent)

The quota is read through the official Qoder SDKs (`@qoder-ai/qoder-agent-sdk` and
`@qodercn-ai/qodercn-agent-sdk`) which reuse the local CLI login. The plugin never reads,
stores, or decrypts credentials.

## Development

- `npm run typecheck`
- `npm run build:sdk-runtime` regenerates `server/sdk-runtime.generated.ts` after `sdk-runtime/package.json` or `sdk-runtime/package-lock.json` change.

## Structure

- `index.client.tsx` / `index.server.ts`: plugin entries
- `client/`: sidebar row and quota screen
- `server/quota.ts`: locked SDK runtime setup and quota fetch
- `server/service.ts`: cache, auto-refresh scheduling, RPC handlers
- `sdk-runtime/`: locked runtime manifest and lockfile used by `npm ci`

---

## 中文

Paseo 插件：在侧边栏展示 Qoder / Qoder CN 账号额度（Credits），并提供可配置自动刷新的明细页。

- 自动聚合所有已登录站点：Qoder CN 和/或 Qoder 国际版，各自独立卡片、独立刷新
- 侧边栏底部行：各站点合计额度（Plan + Add-on + Org 资源包）
- 明细页：套餐信息、额度进度条（80% / 95% 变色预警）、额度用尽提醒、手动刷新
- 自动刷新：关闭 / 5 分钟 / 15 分钟 / 30 分钟 / 1 小时 / 6 小时 / 24 小时
- 更新检查：registry 上有新版本时，额度页顶部显示横幅（仅读取公开的 registry 记录与对应提交的 package.json；不发送任何用户数据）

额度通过官方 Qoder SDK（`@qoder-ai/qoder-agent-sdk` 与
`@qodercn-ai/qodercn-agent-sdk`）读取，SDK 复用本机 CLI 登录态。插件本身不读取、不保存、
不解密登录凭据。

## 开发

- `npm run typecheck`
- `npm run build:sdk-runtime`：在 `sdk-runtime/package.json` 或 `sdk-runtime/package-lock.json` 变更后重新生成 `server/sdk-runtime.generated.ts`

## 目录结构

- `index.client.tsx` / `index.server.ts`：插件入口
- `client/`：侧边栏行与额度明细页
- `server/quota.ts`：锁定的 SDK 运行时准备与额度获取
- `server/service.ts`：缓存、自动刷新调度、RPC 处理器
- `sdk-runtime/`：供 `npm ci` 使用的锁定运行时清单与锁文件
