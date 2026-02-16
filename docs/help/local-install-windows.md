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
