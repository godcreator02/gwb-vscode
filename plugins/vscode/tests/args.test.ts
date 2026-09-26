import { describe, expect, it } from 'vitest'
import {
  parseBrowseArgs,
  parseCommandsArgs,
  parseExecArgs,
  parseNoArgs,
  parseWorkspaceFileAddArgs,
  parseWorkspaceFileRemoveArgs,
} from '../src/args.js'

describe('parseExecArgs', () => {
  it('args 缺省为空数组', () => {
    expect(parseExecArgs({ command: 'workbench.action.terminal.new' })).toEqual({
      command: 'workbench.action.terminal.new',
      args: [],
      window: undefined,
    })
  })

  it('缺 command、args 不是数组、认不出的键都报错', () => {
    expect(() => parseExecArgs({})).toThrow('缺 command')
    expect(() => parseExecArgs({ command: 'x', args: 'y' })).toThrow('args 要是数组')
    expect(() => parseExecArgs({ command: 'x', cmd: 'y' })).toThrow('不认识参数 cmd')
    expect(() => parseExecArgs({ command: 'x', window: 1.5 })).toThrow('window 要是 pid')
  })
})

describe('parseCommandsArgs', () => {
  it('无参数与带 q', () => {
    expect(parseCommandsArgs(undefined)).toEqual({ q: undefined, window: undefined })
    expect(parseCommandsArgs({ q: 'terminal', window: 'dev' })).toEqual({ q: 'terminal', window: 'dev' })
    expect(() => parseCommandsArgs({ q: '' })).toThrow('q 要是非空字符串')
  })
})

describe('parseBrowseArgs', () => {
  it('只收 http / https', () => {
    expect(parseBrowseArgs({ url: 'http://127.0.0.1:4319/docs' })).toEqual({ url: 'http://127.0.0.1:4319/docs', window: undefined })
    expect(() => parseBrowseArgs({ url: 'file:///C:/a.html' })).toThrow('只开 http / https')
    expect(() => parseBrowseArgs({ url: 'localhost:3000' })).toThrow()
    expect(() => parseBrowseArgs({})).toThrow('缺 url')
  })
})

describe('workspace-file 参数', () => {
  it('add 的 folders 逐项校验', () => {
    expect(parseWorkspaceFileAddArgs({ file: 'D:\\a.code-workspace', folders: [{ path: 'D:\\r', name: '仓' }] })).toEqual({
      file: 'D:\\a.code-workspace',
      folders: [{ path: 'D:\\r', name: '仓' }],
    })
    expect(() => parseWorkspaceFileAddArgs({ file: 'x', folders: [] })).toThrow('非空数组')
    expect(() => parseWorkspaceFileAddArgs({ file: 'x', folders: [{ path: 'D:\\r', label: 'y' }] })).toThrow('不认识 label')
    expect(() => parseWorkspaceFileAddArgs({ folders: [{ path: 'D:\\r' }] })).toThrow('缺 file')
  })

  it('remove 的 paths 要是非空字符串数组', () => {
    expect(parseWorkspaceFileRemoveArgs({ file: 'x', paths: ['D:\\r'] })).toEqual({ file: 'x', paths: ['D:\\r'] })
    expect(() => parseWorkspaceFileRemoveArgs({ file: 'x', paths: [''] })).toThrow('paths')
  })
})

describe('parseNoArgs', () => {
  it('给了参数就报错', () => {
    expect(() => parseNoArgs('vscode.windows', { a: 1 })).toThrow('不认识参数 a')
    expect(() => parseNoArgs('vscode.windows', {})).not.toThrow()
  })
})
