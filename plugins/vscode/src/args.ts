import type { WindowSelector } from './windows.js'

/** 三条命令的参数校验：认不出的键直接报错，不静默忽略 */

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
