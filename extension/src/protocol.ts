import path from 'node:path'

/**
 * 与 gwb 插件 `@godcreator/gwb-vscode` 之间的契约：登记文件放在哪、长什么样，HTTP 接口收什么回什么。
 * 插件那边的对应代码在 `plugins/vscode/src/windows.ts`，改一边要同时改另一边。
 * 这个文件不依赖 vscode 模块，`tests/` 里直接测
 */

/** 插件在 cordis.yml 里的条目 id 是 `vscode`，gwb-data 给它的数据目录就是 `<home>/data/vscode` */
export function windowsDirOf(appData: string, home: string): string {
  return path.join(appData, 'gwb-kernel', 'homes', home, 'data', 'vscode', 'windows')
}

export interface WindowRecord {
  pid: number
  port: number
  token: string
  name: string | null
  folders: string[]
  startedAt: string
}

export interface ExecRequest {
  command: string
  args: unknown[]
}

export const MAX_BODY_BYTES = 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseExecRequest(raw: unknown): ExecRequest {
  if (!isRecord(raw)) throw new Error('请求体要是 JSON 对象 { command, args? }')
  const { command, args } = raw
  if (typeof command !== 'string' || command === '') throw new Error('command 要是非空字符串')
  if (args !== undefined && !Array.isArray(args)) throw new Error('args 要是数组')
  return { command, args: args ?? [] }
}

/** 把参数里的 `{ "$uri": "<绝对路径>" }` 换成 `toUri(路径)`，其余原样；只认恰好一个 `$uri` 键的对象 */
export function reviveUris(value: unknown, toUri: (fsPath: string) => unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => reviveUris(item, toUri))
  if (!isRecord(value)) return value
  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === '$uri') {
    const fsPath = value['$uri']
    if (typeof fsPath !== 'string' || !path.isAbsolute(fsPath)) throw new Error(`$uri 要是绝对路径，收到 ${JSON.stringify(fsPath)}`)
    return toUri(fsPath)
  }
  return Object.fromEntries(keys.map((key) => [key, reviveUris(value[key], toUri)]))
}

/**
 * 等命令结束的上限。有的命令要等窗口可见才结束（窗口最小化时新建终端就一直不结束），
 * 过了上限先回执 settled: false，不让调用方一直等
 */
export const EXEC_WAIT_MS = 10_000

export type Settlement<T> = { settled: true; value: T } | { settled: false }

/** promise 在 ms 内结束就回它的值（reject 照样抛出），否则回 settled: false；promise 本身不取消 */
export async function settleWithin<T>(promise: Promise<T>, ms: number): Promise<Settlement<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Settlement<T>>((resolve) => {
    timer = setTimeout(() => resolve({ settled: false }), ms)
  })
  try {
    return await Promise.race([promise.then((value): Settlement<T> => ({ settled: true, value })), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** 命令的返回值做成响应体。undefined 记为 null；无法序列化时说明原因，命令已经执行过了 */
export function execResponseBody(result: unknown): string {
  try {
    return JSON.stringify({ settled: true, result: result ?? null })
  } catch (serializeError: unknown) {
    return JSON.stringify({ settled: true, result: null, resultNotSerializable: String(serializeError) })
  }
}

export function unsettledResponseBody(): string {
  return JSON.stringify({ settled: false, result: null })
}
