import fs from 'node:fs'
import path from 'node:path'
import { applyEdits, modify, parse, printParseErrorCode, type FormattingOptions, type ParseError } from 'jsonc-parser'

/**
 * 读写 `.code-workspace` 文件的 folders。文件是 JSONC（可写注释、结尾逗号），改动用 jsonc-parser 做局部编辑，
 * 原文的注释与排版不动。写入的路径一律相对工作区文件所在目录、用正斜杠，与 VS Code 自己写的一致
 */

export const WORKSPACE_FILE_EXTENSION = '.code-workspace'

export interface FolderToAdd {
  /** 绝对路径，必须是已存在的目录 */
  path: string
  name?: string
}

export interface WorkspaceFolderEntry {
  /** 文件里写的原文；用 uri 形式登记的（远程文件夹之类）为 null */
  written: string | null
  uri: string | null
  /** 按工作区文件所在目录解析出的绝对路径；uri 形式为 null */
  absolutePath: string | null
  name: string | null
  exists: boolean
}

export interface WorkspaceFileView {
  file: string
  folders: WorkspaceFolderEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function assertWorkspaceFilePath(file: string): void {
  if (!path.isAbsolute(file)) throw new Error(`工作区文件要给绝对路径，收到 ${JSON.stringify(file)}`)
  if (!file.endsWith(WORKSPACE_FILE_EXTENSION)) throw new Error(`${file} 不是 ${WORKSPACE_FILE_EXTENSION} 文件`)
}

function readText(file: string): string {
  assertWorkspaceFilePath(file)
  if (!fs.existsSync(file)) throw new Error(`工作区文件不存在：${file}`)
  return fs.readFileSync(file, 'utf8')
}

/** 解析出 folders 数组；语法错误、根不是对象、folders 不是数组都直接报错 */
function parseFolders(file: string, text: string): unknown[] {
  const errors: ParseError[] = []
  const root: unknown = parse(text, errors, { allowTrailingComma: true })
  if (errors.length > 0) {
    const first = errors[0]!
    throw new Error(`${file} 解析失败：${printParseErrorCode(first.error)}（第 ${first.offset} 个字符处）`)
  }
  if (!isRecord(root)) throw new Error(`${file} 的根不是 JSON 对象`)
  const folders = root['folders'] ?? []
  if (!Array.isArray(folders)) throw new Error(`${file} 的 folders 不是数组`)
  return folders
}

function sameFsPath(a: string, b: string): boolean {
  const normalize = (p: string): string => {
    const resolved = path.resolve(p)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return normalize(a) === normalize(b)
}

function entryOf(file: string, raw: unknown, index: number): WorkspaceFolderEntry {
  if (!isRecord(raw)) throw new Error(`${file} 的 folders[${index}] 不是对象`)
  const name = typeof raw['name'] === 'string' ? raw['name'] : null
  if (typeof raw['path'] === 'string') {
    const absolutePath = path.resolve(path.dirname(file), raw['path'])
    return { written: raw['path'], uri: null, absolutePath, name, exists: fs.existsSync(absolutePath) }
  }
  if (typeof raw['uri'] === 'string') return { written: null, uri: raw['uri'], absolutePath: null, name, exists: false }
  throw new Error(`${file} 的 folders[${index}] 既没有 path 也没有 uri`)
}

export function readWorkspaceFile(file: string): WorkspaceFileView {
  const folders = parseFolders(file, readText(file)).map((raw, index) => entryOf(file, raw, index))
  return { file, folders }
}

/** 照原文的缩进格式化插入的内容：出现过行首制表符就用制表符，否则两个空格 */
function formattingOf(text: string): FormattingOptions {
  const usesTabs = /\n\t/.test(text)
  return { insertSpaces: !usesTabs, tabSize: usesTabs ? 1 : 2, eol: text.includes('\r\n') ? '\r\n' : '\n' }
}

export function relativeFolderPath(file: string, folder: string): string {
  const relative = path.relative(path.dirname(file), folder)
  return (relative === '' ? '.' : relative).split(path.sep).join('/')
}

function writeAtomically(file: string, text: string): void {
  const temp = `${file}.tmp`
  fs.writeFileSync(temp, text, 'utf8')
  fs.renameSync(temp, file)
}

function assertFolderToAdd(folder: FolderToAdd, pathsAlreadyIn: string[]): void {
  if (!path.isAbsolute(folder.path)) throw new Error(`要加的文件夹要给绝对路径，收到 ${JSON.stringify(folder.path)}`)
  if (!fs.existsSync(folder.path) || !fs.statSync(folder.path).isDirectory()) throw new Error(`不是已存在的目录：${folder.path}`)
  if (pathsAlreadyIn.some((existingPath) => sameFsPath(existingPath, folder.path))) throw new Error(`${folder.path} 已经在工作区里`)
}

/** 追加到 folders 末尾。任何一个不合格就整批不写 */
export function addFolders(file: string, folders: FolderToAdd[]): WorkspaceFileView {
  let text = readText(file)
  const pathsAlreadyIn = parseFolders(file, text)
    .map((raw, index) => entryOf(file, raw, index).absolutePath)
    .filter((absolutePath) => absolutePath !== null)
  for (const folder of folders) {
    assertFolderToAdd(folder, pathsAlreadyIn)
    pathsAlreadyIn.push(folder.path)
  }
  const formattingOptions = formattingOf(text)
  for (const folder of folders) {
    const value: Record<string, string> = { path: relativeFolderPath(file, folder.path) }
    if (folder.name !== undefined) value['name'] = folder.name
    text = applyEdits(text, modify(text, ['folders', -1], value, { formattingOptions, isArrayInsertion: true }))
  }
  writeAtomically(file, text)
  return readWorkspaceFile(file)
}

/** 按绝对路径移除；有一个找不到就整批不写 */
export function removeFolders(file: string, paths: string[]): WorkspaceFileView {
  let text = readText(file)
  const existing = parseFolders(file, text).map((raw, index) => entryOf(file, raw, index))
  const indexes = paths.map((target) => {
    if (!path.isAbsolute(target)) throw new Error(`要移除的文件夹要给绝对路径，收到 ${JSON.stringify(target)}`)
    const index = existing.findIndex((entry) => entry.absolutePath !== null && sameFsPath(entry.absolutePath, target))
    if (index === -1) {
      const listed = existing.map((entry) => entry.absolutePath ?? entry.uri ?? '').join('、')
      throw new Error(`${target} 不在工作区里，现有：${listed}`)
    }
    return index
  })
  const formattingOptions = formattingOf(text)
  for (const index of [...new Set(indexes)].sort((a, b) => b - a)) {
    text = applyEdits(text, modify(text, ['folders', index], undefined, { formattingOptions }))
  }
  writeAtomically(file, text)
  return readWorkspaceFile(file)
}
