# Qoder Usage

在 Paseo 中查看 Qoder 账号额度（Credits）。

侧边栏底部新增一行「Qoder 额度」，显示两个已用/总量摘要：先是 Plan Credits，接着是 Org 资源包（例如 `548/3000,0/3000`）。点击打开全屏明细：Plan 类型与到期日、Plan Credits、Add-on Credits、Org 资源包，进度条在 80% 与 95% 处变色提示，另有额度用尽提醒与手动刷新。

## 工作原理

额度通过官方 Qoder Agent SDK 读取：SDK 复用本机 qodercli 的登录态，向 Qoder 服务获取账号额度。插件本身不读取、不保存、不解密你的登录凭据。

## 设置

- 需要本机安装并登录 qodercli；额度属于账号级，显示的是当前登录账号的数据。
- 首次读取额度前，界面会提示下载 Qoder Agent SDK（约 1MB，来自 npm registry，依赖树由随包锁文件固定）。只有点击「下载并安装」后才会下载；不安装则不会写入任何文件，也不会有网络请求。
- 支持 macOS 与 Linux；需要 Paseo 0.11.2 或更高版本。

## 自动更新

可选择「关闭 / 5 分钟 / 15 分钟 / 30 分钟 / 1 小时 / 6 小时 / 24 小时」。开启后插件在后台按所选间隔读取一次额度；「关闭」时仅手动刷新。设置保存在本机插件数据目录。

## 数据与权限

- 读取：本机 qodercli 登录态（经由官方 SDK）与 Qoder 服务返回的额度数据。
- 写入：仅本机插件数据目录，用于缓存额度和保存自动更新设置。
- 网络：读取额度时由 SDK 访问 Qoder 服务；未安装 SDK 或未触发读取时不会发起额度请求。另有版本更新检查（每小时最多一次，仅读取公开的 registry 记录与对应提交的 package.json，来自 raw.githubusercontent.com、api.github.com，不发送任何数据）。
- 不发送 prompts、代码或任何文件内容。
