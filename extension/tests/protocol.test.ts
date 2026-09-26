import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { execResponseBody, parseExecRequest, reviveUris, settleWithin, windowsDirOf } from '../src/protocol.ts'

describe('windowsDirOf', () => {
  it('落在 gwb-data 给条目 vscode 的数据目录下', () => {
    expect(windowsDirOf('C:\\AppData', 'default')).toBe(path.join('C:\\AppData', 'gwb-kernel', 'homes', 'default', 'data', 'vscode', 'windows'))
  })
})

describe('parseExecRequest', () => {
  it('args 缺省为空数组，字段不对报错', () => {
    expect(parseExecRequest({ command: 'a' })).toEqual({ command: 'a', args: [] })
    expect(() => parseExecRequest({ command: '' })).toThrow('command')
    expect(() => parseExecRequest({ command: 'a', args: {} })).toThrow('args')
    expect(() => parseExecRequest([])).toThrow('JSON 对象')
  })
})

describe('reviveUris', () => {
  const toUri = (fsPath: string) => ({ uri: fsPath })

  it('只替换恰好一个 $uri 键的对象，嵌套也换', () => {
    const abs = path.resolve('/a/b.ts')
    expect(reviveUris([{ $uri: abs }, { $uri: abs, x: 1 }, 'plain', [{ $uri: abs }]], toUri)).toEqual([
      { uri: abs },
      { $uri: abs, x: 1 },
      'plain',
      [{ uri: abs }],
    ])
  })

  it('$uri 不是绝对路径报错', () => {
    expect(() => reviveUris([{ $uri: 'rel/b.ts' }], toUri)).toThrow('绝对路径')
  })
})

describe('settleWithin', () => {
  it('按时结束回值，reject 照样抛，超时回 settled: false', async () => {
    expect(await settleWithin(Promise.resolve(1), 50)).toEqual({ settled: true, value: 1 })
    await expect(settleWithin(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom')
    expect(await settleWithin(new Promise(() => {}), 10)).toEqual({ settled: false })
  })
})

describe('execResponseBody', () => {
  it('undefined 记为 null，循环引用说明原因', () => {
    expect(JSON.parse(execResponseBody(undefined))).toEqual({ settled: true, result: null })
    const circular: Record<string, unknown> = {}
    circular['self'] = circular
    const body = JSON.parse(execResponseBody(circular)) as Record<string, unknown>
    expect(body['result']).toBeNull()
    expect(typeof body['resultNotSerializable']).toBe('string')
  })
})
