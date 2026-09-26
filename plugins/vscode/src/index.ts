import path from 'node:path'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 空的类型 import 只为让这几个包的 `declare module 'cordis'` 生效，ctx 上才有对应服务的类型
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-data'
import type {} from '@godcreator/gwb-skills'
import {
  parseBrowseArgs,
  parseCommandsArgs,
  parseExecArgs,
  parseNoArgs,
  parseWorkspaceFileAddArgs,
  parseWorkspaceFileReadArgs,
  parseWorkspaceFileRemoveArgs,
} from './args.js'
import { WINDOWS_SUBDIR, callWindow, pickWindow, readLiveWindows, summarizeWindow } from './windows.js'
import { addFolders, readWorkspaceFile, removeFolders } from './workspace-file.js'

export const name = 'gwb-vscode'

/** 登记表放在本插件的数据目录里，扩展按 `<home>/data/vscode/windows` 写，所以数据目录离不开 gwbData */
export const inject = ['gwbCommands', 'gwbData']

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)
  const commands = ctx.gwbCommands
  if (commands === undefined) throw new Error('ctx.gwbCommands 不在：inject 里写了它，cordis 本不该调用 apply')
  const windowsDir = path.join(ctx.gwbData.dir, WINDOWS_SUBDIR)

  commands.register(
    {
      name: 'vscode.windows',
      description: '列出开着的 VS Code 窗口（装了 gwb-vscode 扩展、登记到这个 home 的）',
      usage: '无参数。回 { windows: [{ pid, name, folders, startedAt }] }，name 是工作区名（空窗口为 null）；进程已不在的登记顺手删掉',
    },
    (raw) => {
      parseNoArgs('vscode.windows', raw)
      return { ok: true, data: { windows: readLiveWindows(windowsDir).map(summarizeWindow) } }
    },
  )

  commands.register(
    {
      name: 'vscode.exec',
      description: '在一个 VS Code 窗口里执行一条 VS Code 命令（vscode.commands.executeCommand）',
      usage:
        '参数 { command: string, args?: unknown[], window?: number | string }。command 是命令 ID（如 workbench.action.terminal.new）；args 按位置交给命令，' +
        '要传文件 Uri 就写 { "$uri": "<绝对路径>" }；window 是 pid 或工作区名（精确相等），只开一个窗口时可省。' +
        '回 { window: { pid, name }, settled, result }：settled 为 false 是命令 10 秒内没结束（已交给 VS Code，多半在等窗口显示出来），结果只记在扩展的输出通道；' +
        '返回值无法序列化时 result 为 null 并带 resultNotSerializable 说明原因',
    },
    async (raw) => {
      const { command, args, window } = parseExecArgs(raw)
      const target = pickWindow(readLiveWindows(windowsDir), window)
      const payload = await callWindow(target, 'POST', '/exec', { command, args })
      log.info(`在 pid ${target.pid} 窗口执行 ${command}`)
      return { ok: true, data: { window: { pid: target.pid, name: target.name }, ...(payload as Record<string, unknown>) } }
    },
  )

  commands.register(
    {
      name: 'vscode.commands',
      description: '列出一个 VS Code 窗口里可用的命令 ID，可按子串过滤',
      usage:
        '参数 { q?: string, window?: number | string }。q 按子串过滤（不分大小写），不给就回全部（几千条，建议带 q）；' +
        '不含下划线开头的内部命令。window 同 vscode.exec。回 { window: { pid, name }, commands: string[] }',
    },
    async (raw) => {
      const { q, window } = parseCommandsArgs(raw)
      const target = pickWindow(readLiveWindows(windowsDir), window)
      const payload = (await callWindow(target, 'GET', '/commands')) as { commands: string[] }
      const needle = q?.toLowerCase()
      const filtered = needle === undefined ? payload.commands : payload.commands.filter((id) => id.toLowerCase().includes(needle))
      return { ok: true, data: { window: { pid: target.pid, name: target.name }, commands: filtered } }
    },
  )

  commands.register(
    {
      name: 'vscode.browse',
      description: '在一个 VS Code 窗口的内置浏览器（Simple Browser）里打开网页',
      usage:
        '参数 { url: string, window?: number | string }。url 只收 http / https；window 同 vscode.exec。' +
        '服务进程由调用方自己启动和停止，本命令只负责打开页面。回执同 vscode.exec',
    },
    async (raw) => {
      const { url, window } = parseBrowseArgs(raw)
      const target = pickWindow(readLiveWindows(windowsDir), window)
      const payload = await callWindow(target, 'POST', '/exec', { command: 'simpleBrowser.show', args: [url] })
      log.info(`在 pid ${target.pid} 窗口的内置浏览器打开 ${url}`)
      return { ok: true, data: { window: { pid: target.pid, name: target.name }, ...(payload as Record<string, unknown>) } }
    },
  )

  commands.register(
    {
      name: 'vscode.workspace-file.read',
      description: '读一个 .code-workspace 文件里的文件夹列表',
      usage:
        '参数 { file: string }——.code-workspace 文件的绝对路径。回 { file, folders: [{ written, uri, absolutePath, name, exists }] }：' +
        'written 是文件里写的原文，absolutePath 按工作区文件所在目录解析；uri 形式登记的 written 与 absolutePath 为 null',
    },
    (raw) => ({ ok: true, data: readWorkspaceFile(parseWorkspaceFileReadArgs(raw).file) }),
  )

  commands.register(
    {
      name: 'vscode.workspace-file.add',
      description: '往一个 .code-workspace 文件的 folders 末尾添加文件夹，保留原文的注释与排版',
      usage:
        '参数 { file: string, folders: [{ path: string, name?: string }] }。path 是已存在目录的绝对路径，写进文件时换成相对工作区文件的路径；' +
        '已在工作区里的、不存在的目录直接报错，整批不写。开着这个工作区的 VS Code 窗口会自己刷新。回执同 vscode.workspace-file.read',
    },
    (raw) => {
      const { file, folders } = parseWorkspaceFileAddArgs(raw)
      const view = addFolders(file, folders)
      log.info(`${file} 添加 ${folders.map((f) => f.path).join('、')}`)
      return { ok: true, data: view }
    },
  )

  commands.register(
    {
      name: 'vscode.workspace-file.remove',
      description: '从一个 .code-workspace 文件的 folders 里移除文件夹，保留原文的注释与排版',
      usage:
        '参数 { file: string, paths: string[] }。paths 是要移除文件夹的绝对路径，与文件里的条目按解析后的路径比较；' +
        '有一个不在工作区里就报错，整批不写。回执同 vscode.workspace-file.read',
    },
    (raw) => {
      const { file, paths } = parseWorkspaceFileRemoveArgs(raw)
      const view = removeFolders(file, paths)
      log.info(`${file} 移除 ${paths.join('、')}`)
      return { ok: true, data: view }
    },
  )

  // 说明书在包根的 skills/，相对产物 dist/index.js 写作 '../skills/'；那个目录要在 package.json 的 files 里
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
  })

  log.info(`已加载，窗口登记表在 ${windowsDir}`)
}
