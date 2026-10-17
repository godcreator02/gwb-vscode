// vscode-seams.data.mjs 的类型：数据文件保持 .mjs，因为 docfirst.config.mjs 在 Node 里直接 import 它

export interface SeamModule {
  id: string
  title: string
  lines: string[]
  x: number
  y: number
  w: number
  h: number
  color: string
  disk?: boolean
}

export interface Seam {
  n: number
  /** call 是调用（实线），disk 是读写磁盘（虚线） */
  kind: 'call' | 'disk'
  from: [number, number]
  to: [number, number]
  label: [number, number]
  title: string
  text: string
}

export const modules: SeamModule[]
export const seams: Seam[]
export function seamsAsText(): string
