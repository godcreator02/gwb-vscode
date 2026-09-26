# gwb-vscode

这份 AGENTS.md 由 `docs-site/content/docs/outputs/agents.mdx` 生成：改那份正本，再运行 `pnpm doc:render`。

gwb 插件 `@godcreator/gwb-vscode`（`plugins/vscode/`）加上配套的 VS Code 扩展 `gwb-vscode`（`extension/`）：
让工作台在开着的 VS Code 窗口里执行命令、在内置浏览器里打开网页，并直接读写 `.code-workspace` 文件。

## 硬约束

- **登记文件的形状与 HTTP 接口是两个包之间的契约**：插件那边在 `plugins/vscode/src/windows.ts`，扩展那边在 `extension/src/protocol.ts`，
  改一边要同时改另一边。扩展按插件的条目 id `vscode` 拼登记目录，条目 id 也是契约
- **命令名、参数形状、回执形状是给 agent 的契约**：改了同时改说明书正本 `content/docs/outputs/skills/vscode.mdx`
- **插件不启动、不持有本地服务进程**；工作区增删只经 `.code-workspace` 文件，不调 `updateWorkspaceFolders`
- 参数只在命令入口校验，认不出的键直接报错，不模糊匹配、不纠正

## 怎么跑

仓根：`pnpm build`（插件与扩展）、`pnpm check`（typecheck + oxlint + vitest）。

- 插件在隔离 home 里验证：`devkit.dev {"home":"<home 名>","dir":"<仓根>","packages":["plugins/vscode"]}`，
  发版 `devkit.release {"dir":"<仓根>","packages":["plugins/vscode"]}`，升版本号前读说明书「gwb-release」
- 扩展：`cd extension; pnpm run install:local` 装进 VS Code；已开的窗口重新加载后才换成新代码。
  隔离 home 里验证窗口命令时，把 default 里的登记文件复制进那个 home 的 `data/vscode/windows/`，或把 `gwbVscode.home` 指过去
- 插件的构建优先取依赖的 `module` 字段：jsonc-parser 的 UMD 入口打包后运行时动态 `require` 失败，单元测试测不出来，只有装进 home 才报

写插件读 skill「gwb-devkit」，写文档读「docfirst-docs」。

## 文档

文档站在 `docs-site/`：`pnpm doc` 检查，dev 端口 4313。仓根 README / AGENTS / CLAUDE 与随包说明书
`plugins/vscode/skills/vscode/SKILL.md` 都是生成物，正本在 `docs-site/content/docs/outputs/`。
改了被钉的代码，同一个提交里在站目录 `pnpm doc:confirm` 写回、逐条复核剩下的黄灯。
