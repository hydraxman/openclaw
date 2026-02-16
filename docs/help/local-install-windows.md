# 本地构建并全局安装 OpenClaw（Windows）

适用场景：你维护了本地精简版源码，希望在任意终端直接使用 `openclaw`。

## 一次性安装（首次）

在仓库根目录执行：

```powershell
cd C:\Users\bsp09\Desktop\openclaw
.\pnpm.cmd install
.\pnpm.cmd build
npm link
```

验证：

```powershell
where openclaw
openclaw --version
```

期望 `where openclaw` 输出包含：

- `C:\Users\<你用户名>\AppData\Roaming\npm\openclaw`
- `C:\Users\<你用户名>\AppData\Roaming\npm\openclaw.cmd`

## 为什么这就是“最新本地版本”

`npm link` 会把全局包目录 `...\npm\node_modules\openclaw` 连接到你的仓库目录（Junction/Symlink）。

所以你后续只要在仓库里重新构建，任意终端里的 `openclaw` 就会使用新构建产物。

## 日常更新流程（每次改代码后）

```powershell
cd C:\Users\bsp09\Desktop\openclaw
.\pnpm.cmd build
openclaw --version
```

通常不需要重复 `npm link`。

## 稳定部署流程（推荐，避免 Web UI/飞书故障）

当你要把“当前源码”稳定部署到本机并确保可用时，按下面顺序执行：

```powershell
cd C:\Users\bsp09\Desktop\openclaw

# 1) 安装依赖（首次或依赖变化时）
.\pnpm.cmd install

# 2) 构建主程序 dist
$env:OPENCLAW_A2UI_SKIP_MISSING='1'
.\pnpm.cmd exec tsdown

# 3) 构建 Control UI（修复 "Control UI assets not found"）
.\pnpm.cmd ui:build

# 4) 全局链接到当前源码
npm link

# 5) 重启网关
openclaw gateway stop
openclaw gateway run --bind loopback --port 18789 --force
```

验证（必须全部通过）：

```powershell
npm ls -g openclaw --depth=0
openclaw status --deep
openclaw plugins doctor
```

检查点：

- `npm ls -g openclaw` 显示 `-> ...\Desktop\openclaw`（说明指向本地源码）
- `status --deep` 里 `Gateway reachable`
- 若使用飞书，`status --deep` 里 `Feishu | ON | OK`

## 常见问题与快速修复

### 1) Control UI assets not found

现象：Web UI 提示 `Control UI assets not found...`

修复：

```powershell
cd C:\Users\bsp09\Desktop\openclaw
.\pnpm.cmd ui:build
openclaw gateway stop
openclaw gateway run --bind loopback --port 18789 --force
```

### 2) Windows 下 `pnpm ui:build` 报 `spawn EINVAL`

根因：`scripts/ui.js` 的 Windows `spawn` 兼容问题。

处理建议：

- 保持仓库中 `scripts/ui.js` 的 `spawn/spawnSync` 启用 Windows shell 兼容。
- 修复后重跑 `.\pnpm.cmd ui:build`。

### 3) 飞书插件加载失败（例如 `createDefaultChannelRuntimeState is not a function`）

根因：`plugin-sdk` 导出缺失或构建产物未更新。

修复：

```powershell
cd C:\Users\bsp09\Desktop\openclaw
$env:OPENCLAW_A2UI_SKIP_MISSING='1'
.\pnpm.cmd exec tsdown
openclaw gateway stop
openclaw gateway run --bind loopback --port 18789 --force
openclaw plugins doctor
```

### 4) 网关启动冲突（锁文件/端口占用）

现象：`gateway already running` 或 `Port 18789 is already in use`

修复：

```powershell
openclaw gateway stop
# 仍冲突时再查 PID 并结束占用进程
```

## 重新安装（当全局链接丢失/异常时）

```powershell
npm uninstall -g openclaw
cd C:\Users\bsp09\Desktop\openclaw
npm link
where openclaw
```

## 可选：彻底改回官方 npm 包

如果你以后想退出本地链接模式：

```powershell
npm uninstall -g openclaw
npm install -g openclaw@latest
```
