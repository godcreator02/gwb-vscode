import type { WindowSelector } from './windows.js'
import type { FolderToAdd } from './workspace-file.js'

/** 各命令的参数校验：认不出的键直接报错，不静默忽略 */

export interface ExecArgs {
  command: string
  args: unknown[]
  window: WindowSelector | undefined
}

export interface CommandsArgs {
  q: string | undefined
  window: WindowSelector | undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function objectArgs(commandName: string, raw: unknown, allowedKeys: string[]): Record<string, unknown> {
  if (raw === undefined || raw === null) return {}
  if (!isRecord(raw)) throw new Error(`${commandName} 的参数要是对象`)
  const unknownKeys = Object.keys(raw).filter((key) => !allowedKeys.includes(key))
  if (unknownKeys.length > 0) {
    throw new Error(`${commandName} 不认识参数 ${unknownKeys.join('、')}，只收 ${allowedKeys.join('、')}`)
  }
  return raw
}

function windowSelector(commandName: string, raw: unknown): WindowSelector | undefined {
  if (raw === undefined) return undefined
  if ((typeof raw === 'number' && Number.isInteger(raw)) || (typeof raw === 'string' && raw !== '')) return raw
  throw new Error(`${commandName} 的 window 要是 pid（整数）或工作区名（非空字符串）`)
}

export function parseExecArgs(raw: unknown): ExecArgs {
  const obj = objectArgs('vscode.exec', raw, ['command', 'args', 'window'])
  const { command, args } = obj
  if (typeof command !== 'string' || command === '') throw new Error('vscode.exec 缺 command：VS Code 的命令 ID，如 workbench.action.terminal.new')
  if (args !== undefined && !Array.isArray(args)) throw new Error('vscode.exec 的 args 要是数组，按位置交给命令')
  return { command, args: args ?? [], window: windowSelector('vscode.exec', obj['window']) }
}

export function parseCommandsArgs(raw: unknown): CommandsArgs {
  const obj = objectArgs('vscode.commands', raw, ['q', 'window'])
  const { q } = obj
  if (q !== undefined && (typeof q !== 'string' || q === '')) throw new Error('vscode.commands 的 q 要是非空字符串')
  return { q, window: windowSelector('vscode.commands', obj['window']) }
}

export function parseNoArgs(commandName: string, raw: unknown): void {
  objectArgs(commandName, raw, [])
}

export interface BrowseArgs {
  url: string
  window: WindowSelector | undefined
}

export function parseBrowseArgs(raw: unknown): BrowseArgs {
  const obj = objectArgs('vscode.browse', raw, ['url', 'window'])
  const { url } = obj
  if (typeof url !== 'string') throw new Error('vscode.browse 缺 url')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`vscode.browse 的 url 不是合法地址：${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(`vscode.browse 只开 http / https 地址，收到 ${parsed.protocol}`)
  return { url, window: windowSelector('vscode.browse', obj['window']) }
}

function requireWorkspaceFile(commandName: string, file: unknown): string {
  if (typeof file !== 'string' || file === '') throw new Error(`${commandName} 缺 file：.code-workspace 文件的绝对路径`)
  return file
}

export function parseWorkspaceFileReadArgs(raw: unknown): { file: string } {
  const obj = objectArgs('vscode.workspace-file.read', raw, ['file'])
  return { file: requireWorkspaceFile('vscode.workspace-file.read', obj['file']) }
}

export function parseWorkspaceFileAddArgs(raw: unknown): { file: string; folders: FolderToAdd[] } {
  const commandName = 'vscode.workspace-file.add'
  const obj = objectArgs(commandName, raw, ['file', 'folders'])
  const { folders } = obj
  if (!Array.isArray(folders) || folders.length === 0) throw new Error(`${commandName} 的 folders 要是非空数组 [{ path, name? }]`)
  const parsed = folders.map((folder: unknown, index): FolderToAdd => {
    if (!isRecord(folder)) throw new Error(`${commandName} 的 folders[${index}] 要是对象 { path, name? }`)
    const unknownKeys = Object.keys(folder).filter((key) => key !== 'path' && key !== 'name')
    if (unknownKeys.length > 0) throw new Error(`${commandName} 的 folders[${index}] 不认识 ${unknownKeys.join('、')}`)
    const { path, name } = folder
    if (typeof path !== 'string' || path === '') throw new Error(`${commandName} 的 folders[${index}].path 要是非空字符串`)
    if (name === undefined) return { path }
    if (typeof name !== 'string' || name === '') throw new Error(`${commandName} 的 folders[${index}].name 要是非空字符串`)
    return { path, name }
  })
  return { file: requireWorkspaceFile(commandName, obj['file']), folders: parsed }
}

export function parseWorkspaceFileRemoveArgs(raw: unknown): { file: string; paths: string[] } {
  const commandName = 'vscode.workspace-file.remove'
  const obj = objectArgs(commandName, raw, ['file', 'paths'])
  const { paths } = obj
  if (!Array.isArray(paths) || paths.length === 0 || !paths.every((p) => typeof p === 'string' && p !== '')) {
    throw new Error(`${commandName} 的 paths 要是非空字符串的非空数组`)
  }
  return { file: requireWorkspaceFile(commandName, obj['file']), paths: paths as string[] }
}
