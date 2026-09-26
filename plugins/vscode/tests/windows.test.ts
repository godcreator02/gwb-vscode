import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pickWindow, readLiveWindows, type WindowRecord } from '../src/windows.js'

function record(pid: number, name: string | null, startedAt = `2026-09-26T00:00:0${pid % 10}Z`): WindowRecord {
  return { pid, port: 40000 + pid, token: `t${pid}`, name, folders: [], startedAt }
}

describe('readLiveWindows', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-vscode-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('目录不存在回空数组', () => {
    expect(readLiveWindows(path.join(dir, 'missing'))).toEqual([])
  })

  it('按启动时间排序，进程不在的删掉登记文件', () => {
    fs.writeFileSync(path.join(dir, '2.json'), JSON.stringify(record(2, 'b')))
    fs.writeFileSync(path.join(dir, '1.json'), JSON.stringify(record(1, 'a')))
    fs.writeFileSync(path.join(dir, '3.json'), JSON.stringify(record(3, 'dead')))
    const live = readLiveWindows(dir, (pid) => pid !== 3)
    expect(live.map((w) => w.pid)).toEqual([1, 2])
    expect(fs.existsSync(path.join(dir, '3.json'))).toBe(false)
  })

  it('登记文件字段不对直接报错', () => {
    fs.writeFileSync(path.join(dir, '1.json'), JSON.stringify({ ...record(1, 'a'), port: 'x' }))
    expect(() => readLiveWindows(dir, () => true)).toThrow('port 不是整数')
  })
})

describe('pickWindow', () => {
  const windows = [record(1, 'dev'), record(2, 'paper'), record(3, 'paper')]

  it('没有窗口报错', () => {
    expect(() => pickWindow([], undefined)).toThrow('没有已登记的 VS Code 窗口')
  })

  it('只有一个窗口时可省 selector', () => {
    expect(pickWindow([windows[0]!], undefined).pid).toBe(1)
  })

  it('多个窗口不给 selector 报错并列出窗口', () => {
    expect(() => pickWindow(windows, undefined)).toThrow('开着 3 个 VS Code 窗口')
  })

  it('按 pid 或工作区名精确匹配', () => {
    expect(pickWindow(windows, 2).pid).toBe(2)
    expect(pickWindow(windows, 'dev').pid).toBe(1)
    expect(() => pickWindow(windows, 'de')).toThrow('没有 window 为 "de" 的窗口')
    expect(() => pickWindow(windows, 'paper')).toThrow('对应 2 个窗口')
  })
})
