# gwb-vscode

让 gwb 工作台在开着的 VS Code 窗口里执行任意 VS Code 命令（新建终端、开关面板、打开文件、状态栏按钮背后的命令）、在内置浏览器里打开网页，
并直接读写 `.code-workspace` 文件的文件夹列表。仓是 pnpm workspace，放两个包：

- `plugins/vscode/`：gwb 插件 `@godcreator/gwb-vscode`，命令 `vscode.windows` / `exec` / `commands` / `browse` 与
  `vscode.workspace-file.read` / `add` / `remove`，说明书 `vscode`（`skill.read {"name":"vscode"}`）
- `extension/`：VS Code 扩展 `gwb-vscode`。每个窗口开一个 `127.0.0.1` 随机端口与 token，登记到
  `%APPDATA%\gwb-kernel\homes\<home>\data\vscode\windows\<pid>.json`，窗口关闭时删掉

原理、接缝与取舍在文档站 `docs-site/`（`cd docs-site && pnpm dev`，端口 4313）。

## 构建与检查（仓根）

```powershell
pnpm install
pnpm build   # 插件与扩展
pnpm check   # typecheck + oxlint（插件）+ vitest
```

## 装

- 扩展：`cd extension; pnpm run install:local`（打成 vsix，`code --install-extension` 装进 VS Code）；
  设置 `gwbVscode.home` 决定登记到哪个 home，默认 `default`
- 插件：`plugin-manager.install {"pkg":"@godcreator/gwb-vscode"}`；在隔离 home 里验证用
  `devkit.dev {"home":"<home 名>","dir":"<仓根>","packages":["plugins/vscode"]}`
