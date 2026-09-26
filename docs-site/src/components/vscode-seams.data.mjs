/**
 * 首页接缝图的数据：画面（vscode-seams.tsx）与机读文本（docfirst.config.mjs 的名册规则）读同一份。
 * 编号与首页正文「接缝逐条」的小节一一对应。
 */

export const modules = [
  { id: 'agent', title: 'agent', lines: ['经 MCP 入口 run 调命令', '自己启动、停止本地服务'], x: 20, y: 20, w: 200, h: 92, color: '#ffd23f' },
  { id: 'plugin', title: 'gwb 插件 gwb-vscode', lines: ['工作台主进程里', 'vscode.* 命令', '选窗口 · 转发请求', '读写工作区文件'], x: 300, y: 20, w: 240, h: 128, color: '#7bdff2' },
  { id: 'skills', title: '说明书插件', lines: ['登记说明书 vscode'], x: 620, y: 20, w: 200, h: 72, color: '#e0e0e0' },
  { id: 'registry', title: '窗口登记目录', lines: ['<home>/data/vscode/', 'windows/<pid>.json'], x: 300, y: 214, w: 196, h: 86, color: '#f6f5ae', disk: true },
  { id: 'wsfile', title: '.code-workspace 文件', lines: ['folders 一段', 'JSONC，带注释'], x: 20, y: 214, w: 200, h: 86, color: '#f6f5ae', disk: true },
  { id: 'extension', title: 'VS Code 扩展 gwb-vscode', lines: ['每个窗口的扩展进程里', '127.0.0.1 随机端口 + token'], x: 300, y: 366, w: 240, h: 92, color: '#b2f7b1' },
  { id: 'vscode', title: 'VS Code 窗口', lines: ['executeCommand', '内置浏览器 · 工作区'], x: 620, y: 366, w: 200, h: 92, color: '#ff9bd2' },
  { id: 'server', title: '本地服务', lines: ['文档站 dev / start 等', '由 agent 持有'], x: 620, y: 214, w: 200, h: 86, color: '#ffb385' },
]

/** kind：call 是调用（实线），disk 是读写磁盘（虚线） */
export const seams = [
  {
    n: 1,
    kind: 'call',
    from: [220, 60],
    to: [300, 60],
    label: [258, 50],
    title: 'agent → 插件',
    text: 'agent 经 MCP 入口 run 调 vscode.* 命令，参数形状写在每条命令的 usage 里；认不出的参数直接报错。',
  },
  {
    n: 2,
    kind: 'disk',
    from: [440, 366],
    to: [440, 300],
    label: [458, 336],
    title: '扩展 ⇢ 登记目录',
    text: '窗口启动时扩展写一份 {pid, port, token, name, folders, startedAt}，工作区文件夹变了就重写，窗口关闭时删掉。',
  },
  {
    n: 3,
    kind: 'disk',
    from: [400, 214],
    to: [400, 148],
    label: [382, 184],
    title: '插件 ⇢ 登记目录',
    text: '每次调用现读整个目录，按 pid 或工作区名选窗口；进程已经不在的登记当场删掉。',
  },
  {
    n: 4,
    kind: 'call',
    from: [520, 148],
    to: [520, 366],
    label: [538, 262],
    title: '插件 → 扩展（HTTP）',
    text: 'POST /exec {command, args} 与 GET /commands，请求头带 Authorization: Bearer <token>；命令 10 秒内不结束先回 settled: false。',
  },
  {
    n: 5,
    kind: 'call',
    from: [540, 412],
    to: [620, 412],
    label: [580, 402],
    title: '扩展 → VS Code',
    text: '扩展把 {"$uri": 路径} 换成 Uri，调 vscode.commands.executeCommand；返回值按 JSON 回给插件。',
  },
  {
    n: 6,
    kind: 'disk',
    from: [300, 110],
    to: [160, 214],
    label: [226, 150],
    title: '插件 ⇢ 工作区文件',
    text: '插件直接读写 .code-workspace 的 folders，只动那一段；开着这个工作区的窗口自己察觉文件变化并刷新。',
  },
  {
    n: 7,
    kind: 'call',
    from: [720, 366],
    to: [720, 300],
    label: [738, 336],
    title: '内置浏览器 → 本地服务',
    text: 'vscode.browse 让窗口执行 simpleBrowser.show 打开地址；服务进程由 agent 自己启动和停止，插件不碰。',
  },
  {
    n: 8,
    kind: 'call',
    from: [540, 56],
    to: [620, 56],
    label: [580, 46],
    title: '插件 → 说明书插件',
    text: '局部注入 gwbSkills，登记包里的 skills/ 目录；没装说明书插件时命令照常可用，只是 agent 读不到说明书。',
  },
]

export function seamsAsText() {
  const moduleText = modules.map((m) => `${m.title}（${m.lines.join('，')}）`).join('；')
  const seamText = seams.map((s) => `${s.n} ${s.title}：${s.text}`).join(' ')
  return `[接缝图] 模块：${moduleText}。接缝：${seamText}`
}
