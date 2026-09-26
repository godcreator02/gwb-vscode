# gwb-vscode

让 gwb 工作台在开着的 VS Code 窗口里执行任意 VS Code 命令（新建终端、开关面板、打开文件、状态栏按钮背后的命令……）。
仓是 pnpm workspace，放两个包：

- `plugins/vscode/`：gwb 插件 `@godcreator/gwb-vscode`，命令 `vscode.windows` / `vscode.exec` / `vscode.commands`，
  说明书 `vscode`（`skill.read {"name":"vscode"}`）
- `extension/`：VS Code 扩展 `gwb-vscode`。每个窗口启动时开一个 `127.0.0.1` 随机端口、生成 token，
  把 `{ pid, port, token, name, folders, startedAt }` 写进 `%APPDATA%\gwb-kernel\homes\<home>\data\vscode\windows\<pid>.json`，
  窗口关闭时删掉；接口 `POST /exec {command, args}` 与 `GET /commands`，请求头要带 `Authorization: Bearer <token>`

插件读登记目录（就是 gwb-data 给条目 `vscode` 的数据目录），按 pid 或工作区名选窗口，把请求转给那个窗口的扩展。
登记文件的形状与 HTTP 接口是两个包之间的契约，两边的代码在 `plugins/vscode/src/windows.ts` 与 `extension/src/protocol.ts`，
改一边要同时改另一边。

## 构建与检查（仓根）

```powershell
pnpm install
pnpm build   # 插件与扩展
pnpm check   # typecheck + oxlint（插件）+ vitest
```

## 装

- 扩展：`cd extension; pnpm run install:local`（打成 vsix，`code --install-extension` 装进 VS Code）；
  设置 `gwbVscode.home` 决定登记到哪个 home，默认 `default`
- 插件：在隔离 home 里验证用 `devkit.dev {"home":"<home 名>","dir":"<仓根>","packages":["plugins/vscode"]}`；
  发版用 `devkit.release {"dir":"<仓根>","packages":["plugins/vscode"]}`，升版本号前读说明书「gwb-release」
