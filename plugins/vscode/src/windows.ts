import fs from 'node:fs'
import path from 'node:path'

/**
 * VS Code 窗口登记表：扩展在每个窗口启动时往 `<本插件数据目录>/windows/<pid>.json` 写一份 `WindowRecord`，
 * 窗口关闭时删掉。登记文件的形状与 HTTP 接口是扩展（仓里 `extension/`）与本插件之间的契约，改一边要同时改另一边
 */

export const WINDOWS_SUBDIR = 'windows'

export interface WindowRecord {
  pid: number
  port: number
  token: string
  /** `vscode.workspace.name`：打开工作区文件时是工作区名，只开一个文件夹时是文件夹名，空窗口没有 */
  name: string | null
  folders: string[]
  startedAt: string
}

/** 回给调用方的窗口信息，不带端口与 token */
export interface WindowSummary {
  pid: number
  name: string | null
  folders: string[]
  startedAt: string
}

/** 按 pid（数字）或工作区名（字符串，精确相等）选窗口 */
export type WindowSelector = number | string

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseWindowRecord(file: string, raw: unknown): WindowRecord {
  if (!isRecord(raw)) throw new Error(`${file} 不是 JSON 对象`)
  const { pid, port, token, name, folders, startedAt } = raw
  if (typeof pid !== 'number' || !Number.isInteger(pid)) throw new Error(`${file} 的 pid 不是整数`)
  if (typeof port !== 'number' || !Number.isInteger(port)) throw new Error(`${file} 的 port 不是整数`)
  if (typeof token !== 'string' || token === '') throw new Error(`${file} 的 token 不是非空字符串`)
  if (name !== null && typeof name !== 'string') throw new Error(`${file} 的 name 既不是字符串也不是 null`)
  if (!Array.isArray(folders) || !folders.every((folder) => typeof folder === 'string')) {
    throw new Error(`${file} 的 folders 不是字符串数组`)
  }
  if (typeof startedAt !== 'string') throw new Error(`${file} 的 startedAt 不是字符串`)
  return { pid, port, token, name, folders: folders as string[], startedAt }
}

/** `process.kill(pid, 0)` 只探测不发信号：ESRCH 是进程不在，EPERM 是在但没权限 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (probeError: unknown) {
    return (probeError as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * 读出全部登记的窗口。进程已经不在的（VS Code 崩溃、没来得及删）当场删掉登记文件。
 * 目录不存在说明还没有窗口登记过，回空数组
 */
export function readLiveWindows(windowsDir: string, isAlive: (pid: number) => boolean = isProcessAlive): WindowRecord[] {
  if (!fs.existsSync(windowsDir)) return []
  const live: WindowRecord[] = []
  for (const fileName of fs.readdirSync(windowsDir)) {
    if (!fileName.endsWith('.json')) continue
    const file = path.join(windowsDir, fileName)
    const record = parseWindowRecord(file, JSON.parse(fs.readFileSync(file, 'utf8')) as unknown)
    if (isAlive(record.pid)) live.push(record)
    else fs.rmSync(file, { force: true })
  }
  return live.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

export function summarizeWindow(record: WindowRecord): WindowSummary {
  return { pid: record.pid, name: record.name, folders: record.folders, startedAt: record.startedAt }
}

function describeWindows(windows: WindowRecord[]): string {
  return windows.map((w) => `pid ${w.pid}「${w.name ?? '空窗口'}」`).join('、')
}

/** 没给 selector 时只有一个窗口才能选；给了就按 pid 或工作区名精确匹配 */
export function pickWindow(windows: WindowRecord[], selector: WindowSelector | undefined): WindowRecord {
  if (windows.length === 0) {
    throw new Error('没有已登记的 VS Code 窗口：确认 VS Code 开着、装了 gwb-vscode 扩展，且扩展设置 gwbVscode.home 指向这个 home')
  }
  if (selector === undefined) {
    if (windows.length === 1) return windows[0]!
    throw new Error(`开着 ${windows.length} 个 VS Code 窗口，用 window 指定一个（pid 或工作区名）：${describeWindows(windows)}`)
  }
  const matched = windows.filter((w) => (typeof selector === 'number' ? w.pid === selector : w.name === selector))
  if (matched.length === 1) return matched[0]!
  if (matched.length === 0) throw new Error(`没有 window 为 ${JSON.stringify(selector)} 的窗口，现有：${describeWindows(windows)}`)
  throw new Error(`工作区名 ${JSON.stringify(selector)} 对应 ${matched.length} 个窗口，改用 pid 指定：${describeWindows(matched)}`)
}

/** 调一个窗口的扩展接口。扩展回的非 2xx 带 `{ error }`，原样转成异常 */
export async function callWindow(record: WindowRecord, method: 'GET' | 'POST', route: string, body?: unknown): Promise<unknown> {
  const init: RequestInit = {
    method,
    headers: { authorization: `Bearer ${record.token}`, 'content-type': 'application/json' },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  let response: Response
  try {
    response = await fetch(`http://127.0.0.1:${record.port}${route}`, init)
  } catch (connectError: unknown) {
    throw new Error(`连不上 pid ${record.pid} 窗口的扩展（端口 ${record.port}）：${String(connectError)}`)
  }
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    const reason = isRecord(payload) && typeof payload['error'] === 'string' ? payload['error'] : JSON.stringify(payload)
    throw new Error(`pid ${record.pid} 窗口回 ${response.status}：${reason}`)
  }
  return payload
}
