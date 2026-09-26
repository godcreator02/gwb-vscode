import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addFolders, readWorkspaceFile, removeFolders } from '../src/workspace-file.js'

const ORIGINAL = `{
\t// 正在开发的仓
\t"folders": [
\t\t{
\t\t\t"name": "甲",
\t\t\t"path": "../repos/a"
\t\t},
\t],
\t"settings": { "files.exclude": { "**/node_modules": true } }
}
`

describe('.code-workspace 读写', () => {
  let root: string
  let file: string
  const repo = (name: string): string => path.join(root, 'repos', name)

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-vscode-ws-'))
    for (const name of ['a', 'b', 'c']) fs.mkdirSync(repo(name), { recursive: true })
    fs.mkdirSync(path.join(root, 'ws'))
    file = path.join(root, 'ws', 'dev.code-workspace')
    fs.writeFileSync(file, ORIGINAL)
  })
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('读出原文路径、解析后的绝对路径、名字与是否存在', () => {
    expect(readWorkspaceFile(file).folders).toEqual([
      { written: '../repos/a', uri: null, absolutePath: repo('a'), name: '甲', exists: true },
    ])
  })

  it('添加写成相对路径、保留注释与制表符缩进', () => {
    const view = addFolders(file, [{ path: repo('b'), name: '乙' }, { path: repo('c') }])
    expect(view.folders.map((f) => [f.written, f.name])).toEqual([
      ['../repos/a', '甲'],
      ['../repos/b', '乙'],
      ['../repos/c', null],
    ])
    const text = fs.readFileSync(file, 'utf8')
    expect(text).toContain('// 正在开发的仓')
    expect(text).toContain('\t\t{\n\t\t\t"path": "../repos/b",\n\t\t\t"name": "乙"\n\t\t}')
    expect(text).not.toMatch(/\n {2}\S/)
  })

  it('重复、不存在、相对路径都整批不写', () => {
    expect(() => addFolders(file, [{ path: repo('b') }, { path: repo('a') }])).toThrow('已经在工作区里')
    expect(() => addFolders(file, [{ path: repo('b') }, { path: repo('b') }])).toThrow('已经在工作区里')
    expect(() => addFolders(file, [{ path: path.join(root, 'missing') }])).toThrow('不是已存在的目录')
    expect(() => addFolders(file, [{ path: 'repos/b' }])).toThrow('绝对路径')
    expect(fs.readFileSync(file, 'utf8')).toBe(ORIGINAL)
  })

  it('按绝对路径移除，找不到就整批不写', () => {
    addFolders(file, [{ path: repo('b') }, { path: repo('c') }])
    expect(() => removeFolders(file, [repo('a'), path.join(root, 'nope')])).toThrow('不在工作区里')
    const view = removeFolders(file, [repo('a'), repo('c')])
    expect(view.folders.map((f) => f.written)).toEqual(['../repos/b'])
    expect(fs.readFileSync(file, 'utf8')).toContain('// 正在开发的仓')
  })

  it('文件不是 .code-workspace、不存在、语法错误都报错', () => {
    expect(() => readWorkspaceFile(path.join(root, 'x.json'))).toThrow('不是 .code-workspace')
    expect(() => readWorkspaceFile(path.join(root, 'none.code-workspace'))).toThrow('不存在')
    fs.writeFileSync(file, '{ "folders": [ }')
    expect(() => readWorkspaceFile(file)).toThrow('解析失败')
  })
})
