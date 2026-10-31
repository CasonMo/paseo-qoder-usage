# Qoder 额度

在 Paseo 中查看 Qoder 与 Qoder CN 账号额度（Credits）。

插件会自动检测 `~/.qoder` 与 `~/.qoder-cn` 的登录态，把所有已登录站点聚合在同一个额度页：有国内版就显示 Qoder CN，有国际版就显示 Qoder，两个都有就同时显示。每个站点是一张独立卡片，拥有独立的刷新按钮；刷新一个站点不会阻塞另一个。侧边栏底部显示各站点合计额度（Plan + Add-on + Org 资源包，例如 `CN 0/3000 · Qoder 0/6000`）。卡片内展示 Plan 类型与到期日、Plan Credits、Add-on Credits、Org 资源包，进度条在 80% 与 95% 处变色提示，另有额度用尽提醒与手动刷新。

## 工作原理

额度通过官方 Qoder SDK 读取：国际版使用 `@qoder-ai/qoder-agent-sdk` 与 qodercli，国内版使用 `@qodercn-ai/qodercn-agent-sdk` 与 qoderclicn/qodercn。SDK 复用本机 CLI 的登录态，向 Qoder 服务获取账号额度。插件本身不读取、不保存、不解密你的登录凭据。

## 设置

- 需要本机安装并登录 qodercli 或 qodercn；额度属于账号级，显示的是当前登录账号的数据。
- 首次读取额度前，界面会提示下载 Qoder SDK（国际版 + 国内版，含锁定依赖约 30MB，来自 npm registry）。只有点击「下载并安装」后才会下载；不安装则不会写入 SDK 文件，也不会发起额度请求。公开的版本检查仍可能运行。
- 支持 macOS 与 Linux；需要 Paseo 0.11.2 或更高版本。

## 自动更新

可选择「关闭 / 5 分钟 / 15 分钟 / 30 分钟 / 1 小时 / 6 小时 / 24 小时」。开启后插件在后台按所选间隔读取一次额度；「关闭」时仅手动刷新。设置保存在本机插件数据目录。

## 数据与权限

- 读取：本机 qodercli 或 qodercn 登录态（经由官方 SDK）与 Qoder 服务返回的额度数据。
- 写入：仅本机插件数据目录，用于缓存额度和保存自动更新设置。
- 网络：读取额度时由 SDK 访问 Qoder 服务；未安装 SDK 或未触发读取时不会发起额度请求。另有版本更新检查（每小时最多一次，仅读取公开的 registry 记录与对应提交的 package.json，来自 raw.githubusercontent.com、api.github.com，不发送任何数据）。
- 不发送 prompts、代码或任何文件内容。
