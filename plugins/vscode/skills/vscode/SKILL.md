---
name: vscode
description: 要在用户开着的 VS Code 里做事时读——新建终端、开关面板或侧栏、打开文件、切视图、触发状态栏按钮或命令面板里的某条命令、查命令 ID；要在 VS Code 内置浏览器里看本地起的页面（文档站 dev / start）；要增删 .code-workspace 工作区文件里的文件夹。讲七条命令怎么用、多窗口怎么选、参数里怎么传文件、状态栏按钮的命令 ID 去哪找、服务进程谁来管。
---

# 操作 VS Code

VS Code 里每个动作（菜单项、快捷键、状态栏按钮、命令面板里的一条）背后都是一条命令，有一个命令 ID。
本插件经配套的 VS Code 扩展 `gwb-vscode`，在指定窗口里执行 `vscode.commands.executeCommand(命令 ID, ...args)`；
另外直接读写 `.code-workspace` 文件，这部分不需要 VS Code 开着。

## 命令

| 命令 | 做什么 |
| --- | --- |
| `vscode.windows` | 列出开着的窗口：`pid`、`name`（工作区名）、`folders` |
| `vscode.exec {"command": "<命令 ID>", "args": [...], "window": <pid 或工作区名>}` | 执行一条命令，回执里的 `result` 是命令的返回值 |
| `vscode.commands {"q": "<子串>", "window": ...}` | 列出命令 ID，按子串过滤（不分大小写） |
| `vscode.browse {"url": "http://127.0.0.1:4319/", "window": ...}` | 在内置浏览器（Simple Browser）里打开网页 |
| `vscode.workspace-file.read {"file": "<.code-workspace 绝对路径>"}` | 列出工作区文件里的文件夹 |
| `vscode.workspace-file.add {"file": ..., "folders": [{"path": "<绝对路径>", "name": "<显示名>"}]}` | 往末尾添加文件夹 |
| `vscode.workspace-file.remove {"file": ..., "paths": ["<绝对路径>"]}` | 移除文件夹 |

* **选窗口**：只开一个窗口时 `window` 可省；开了多个不给就报错并列出全部窗口。`window` 写 pid（整数）或工作区名
  （字符串，与 `vscode.windows` 回的 `name` 完全相等），不做模糊匹配
* **传文件**：命令要 `Uri` 参数时写 `{"$uri": "<绝对路径>"}`，扩展把它换成 `vscode.Uri.file(路径)`；
  其余参数按 JSON 原样交给命令
* **返回值**：`Uri` 这类对象会按 JSON 序列化；无法序列化的（循环引用）`result` 为 `null`，同时带 `resultNotSerializable` 说明原因——命令已经执行了
* **`settled: false`**：命令 10 秒内没结束，扩展先回执、不再等。命令已经交给 VS Code，最后成没成只记在那个窗口的输出通道
  「gwb-vscode」里。实测过的一例：窗口不在屏幕上（最小化或在别的虚拟桌面）时新建终端，命令一直不结束，也没有启动 shell 进程。遇到时告诉用户切到那个窗口，别重复发同一条命令

## 在内置浏览器里看本地页面

服务进程由你（agent）自己启动、自己停，本插件不管进程，只负责打开页面：

1. 用你所在客户端自己的方式启动服务。Claude Code 桌面版：在 `.claude/launch.json` 里写一条配置、用 `preview_start` 启动，
   要到点自动停就用 `node <超时脚本> <分钟> <站目录> pnpm exec next dev -p <端口> -H 127.0.0.1` 这类包一层超时的写法；
   别的客户端在后台运行 shell 命令。端口照站自己 `package.json` 里的脚本
2. 等端口能连上，再 `vscode.browse {"url": "http://127.0.0.1:<端口>/"}`
3. 用完照你启动它的方式停掉；用户说要一直看着的，就一直开着

## 工作区文件

* `.code-workspace` 是 JSONC（能写注释、结尾逗号）。增删只改 `folders` 那一段，注释与缩进保留
* 参数里的路径一律给绝对路径；写进文件时换成相对工作区文件所在目录的路径（正斜杠），与 VS Code 自己写的一致
* 已在工作区里、目录不存在、要移除的不在工作区里，都直接报错、整批不写
* 开着这个工作区的 VS Code 窗口会自己察觉文件变化并刷新文件夹列表，不用重新加载窗口
* 某个工作区文件有自己的约定（比如必须起中文显示名、只放仓目录）时，照那份约定填 `name` 与 `path`，本插件不查这些

## 常用命令 ID

| 想做的事 | 命令 ID | 参数 |
| --- | --- | --- |
| 新建终端 | `workbench.action.terminal.new` | |
| 开关底部面板 | `workbench.action.togglePanel` | |
| 开关侧栏 | `workbench.action.toggleSidebarVisibility` | |
| 资源管理器 / 搜索 / 源代码管理 | `workbench.view.explorer` / `workbench.view.search` / `workbench.view.scm` | |
| 打开文件 | `vscode.open` | `[{"$uri": "D:\\a\\b.ts"}]` |
| 在资源管理器里定位文件 | `revealInExplorer` | `[{"$uri": "..."}]` |
| 在新窗口打开文件夹或工作区文件 | `vscode.openFolder` | `[{"$uri": "..."}, {"forceNewWindow": true}]` |
| 保存全部 | `workbench.action.files.saveAll` | |
| 重新加载窗口 | `workbench.action.reloadWindow` | 执行后这次调用可能收不到回执 |
| 关闭窗口 | `workbench.action.closeWindow` | |
| 打开设置界面 | `workbench.action.openSettings` | `["<搜索词>"]` |

不确定命令 ID 时先 `vscode.commands {"q": "terminal"}` 查，不要猜。

## 状态栏按钮对应哪条命令

VS Code 没有接口能列出别的扩展放在状态栏上的按钮，所以只能按下面的办法查：

1. `vscode.commands {"q": "<按钮相关的词>"}` 按关键字找
2. 让用户在 VS Code 的「键盘快捷方式」编辑器里搜到那条命令，右键「复制命令 ID」
3. 扩展放的按钮，命令 ID 写在那个扩展 `package.json` 的 `contributes.commands` 里
   （扩展装在 `%USERPROFILE%\.vscode\extensions\<发布者>.<名>-<版本>\`）

## 出错时

* 「没有已登记的 VS Code 窗口」：VS Code 没开，或没装 `gwb-vscode` 扩展，或扩展设置 `gwbVscode.home` 指的不是当前 home
  （默认 `default`）。扩展登记文件写在 `%APPDATA%\gwb-kernel\homes\<home>\data\vscode\windows\<pid>.json`
* 「连不上 pid … 窗口的扩展」：那个窗口的扩展没在运行（窗口正在重新加载，或扩展被禁用）。过一会再试，或让用户重新加载那个窗口
* 「pid … 窗口回 500」：命令本身执行失败，原因原样带在报错里
