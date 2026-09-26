// VS Code 扩展宿主只认 CommonJS 入口；vscode 模块由宿主注入，外置
import { build } from 'esbuild'

await build({
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  logLevel: 'info',
})
