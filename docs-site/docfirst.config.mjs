/**
 * docfirst 配置：命令行和站读的是同一份。项目根是这个站目录，被钉的代码在仓根的 `plugins/vscode/` 与 `extension/`，
 * 引用写 `../plugins/vscode/…`、`../extension/…`。
 *
 * content 下 `trajectory/` 与 `future/` 两个名字固定，其余目录都是现状区、全部进 check；本站的现状区是 `content/docs/`。
 *
 * 生成物的正本都在 `content/docs/outputs/`：仓根 README.md / AGENTS.md / CLAUDE.md，外加随插件包发布的说明书
 * `plugins/vscode/skills/vscode/SKILL.md`（要保留 frontmatter 的 name 与 description，gwb-skills 登记时读它们）。
 * 改正本后运行 `pnpm doc:render`，正本与生成物放进同一个提交。生成正本按原文渲染，里面不能用 JSX 组件。
 */
import { fumadocsRoster } from '@godcreator/docfirst-workflow/fumadocs/roster'
import { seamsAsText } from './src/components/vscode-seams.data.mjs'

export default {
  content: 'content',
  outputs: {
    'content/docs/outputs/readme.mdx': ['../README.md'],
    'content/docs/outputs/agents.mdx': ['../AGENTS.md'],
    'content/docs/outputs/claude.mdx': ['../CLAUDE.md'],
    'content/docs/outputs/skills/vscode.mdx': [
      { to: '../plugins/vscode/skills/vscode/SKILL.md', frontmatter: ['name', 'description'] },
    ],
  },
  components: {
    ...fumadocsRoster,
    VscodeSeams: (node, h) => h.paragraph(seamsAsText()),
  },
}
