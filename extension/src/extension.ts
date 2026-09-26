import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import * as vscode from 'vscode'
import {
  EXEC_WAIT_MS,
  MAX_BODY_BYTES,
  execResponseBody,
  parseExecRequest,
  reviveUris,
  settleWithin,
  unsettledResponseBody,
  windowsDirOf,
  type Settlement,
  type WindowRecord,
} from './protocol.ts'

/**
 * 每个窗口的扩展宿主各开一个 127.0.0.1 随机端口，收到带 token 的请求就执行 VS Code 命令；
 * 端口与 token 登记到 gwb home 的数据目录，gwb 插件读登记表找到窗口
 */

const token = crypto.randomBytes(24).toString('hex')
const startedAt = new Date().toISOString()
let server: http.Server | undefined
let registeredFile: string | undefined
let output: vscode.OutputChannel

function configuredWindowsDir(): string {
  const appData = process.env['APPDATA']
  if (appData === undefined || appData === '') throw new Error('环境变量 APPDATA 不在：gwb home 的位置由它算出')
  const home = vscode.workspace.getConfiguration('gwbVscode').get<string>('home')
  if (home === undefined || home === '') throw new Error('设置 gwbVscode.home 不能为空')
  return windowsDirOf(appData, home)
}

function currentRecord(port: number): WindowRecord {
  return {
    pid: process.pid,
    port,
    token,
    name: vscode.workspace.name ?? null,
    folders: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
    startedAt,
  }
}

function unregister(): void {
  if (registeredFile === undefined) return
  fs.rmSync(registeredFile, { force: true })
  registeredFile = undefined
}

/** 整份重写登记文件；换了 home 就先删掉旧 home 里的那份 */
function register(): void {
  if (server === undefined) return
  const port = (server.address() as AddressInfo).port
  const dir = configuredWindowsDir()
  const file = path.join(dir, `${process.pid}.json`)
  if (registeredFile !== undefined && registeredFile !== file) unregister()
  fs.mkdirSync(dir, { recursive: true })
  const temp = `${file}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(currentRecord(port), null, 2)}\n`, 'utf8')
  fs.renameSync(temp, file)
  registeredFile = file
  output.appendLine(`已登记：${file}（端口 ${port}）`)
}

function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`请求体超过 ${MAX_BODY_BYTES} 字节`))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function reply(response: http.ServerResponse, status: number, body: string): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(body)
}

async function handleExec(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
  let exec
  try {
    exec = parseExecRequest(JSON.parse(await readBody(request)) as unknown)
  } catch (badRequest: unknown) {
    reply(response, 400, JSON.stringify({ error: String(badRequest) }))
    return
  }
  let settlement: Settlement<unknown>
  try {
    const args = reviveUris(exec.args, (fsPath) => vscode.Uri.file(fsPath)) as unknown[]
    const running = Promise.resolve(vscode.commands.executeCommand(exec.command, ...args))
    settlement = await settleWithin(running, EXEC_WAIT_MS)
    if (!settlement.settled) {
      running.then(
        () => output.appendLine(`${exec.command} 超过 ${EXEC_WAIT_MS} 毫秒后执行完`),
        (lateError: unknown) => output.appendLine(`${exec.command} 超过 ${EXEC_WAIT_MS} 毫秒后失败：${String(lateError)}`),
      )
    }
  } catch (commandError: unknown) {
    reply(response, 500, JSON.stringify({ error: String(commandError) }))
    return
  }
  output.appendLine(settlement.settled ? `执行 ${exec.command}` : `执行 ${exec.command}：${EXEC_WAIT_MS} 毫秒内没有结束`)
  reply(response, 200, settlement.settled ? execResponseBody(settlement.value) : unsettledResponseBody())
}

async function handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
  if (request.headers.authorization !== `Bearer ${token}`) {
    reply(response, 401, JSON.stringify({ error: 'token 不对' }))
    return
  }
  if (request.method === 'POST' && request.url === '/exec') {
    await handleExec(request, response)
    return
  }
  if (request.method === 'GET' && request.url === '/commands') {
    const commands = (await vscode.commands.getCommands(true)).sort()
    reply(response, 200, JSON.stringify({ commands }))
    return
  }
  reply(response, 404, JSON.stringify({ error: `没有这个接口：${request.method ?? ''} ${request.url ?? ''}，只有 POST /exec 与 GET /commands` }))
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('gwb-vscode')
  context.subscriptions.push(output)
  server = http.createServer((request, response) => {
    handle(request, response).catch((unexpected: unknown) => {
      output.appendLine(`处理请求出错：${String(unexpected)}`)
      if (!response.headersSent) reply(response, 500, JSON.stringify({ error: String(unexpected) }))
    })
  })
  server.listen(0, '127.0.0.1', () => {
    try {
      register()
    } catch (registerError: unknown) {
      output.appendLine(`登记失败：${String(registerError)}`)
      void vscode.window.showErrorMessage(`gwb-vscode 登记失败：${String(registerError)}`)
    }
  })
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => register()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('gwbVscode.home')) register()
    }),
  )
}

export function deactivate(): void {
  unregister()
  server?.close()
  server = undefined
}
