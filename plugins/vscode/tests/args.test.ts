import { describe, expect, it } from 'vitest'
import { parseCommandsArgs, parseExecArgs, parseNoArgs } from '../src/args.js'

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

describe('parseNoArgs', () => {
  it('给了参数就报错', () => {
    expect(() => parseNoArgs('vscode.windows', { a: 1 })).toThrow('不认识参数 a')
    expect(() => parseNoArgs('vscode.windows', {})).not.toThrow()
  })
})
