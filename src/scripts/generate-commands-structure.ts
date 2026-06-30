import fs from 'fs'
import path from 'path'
import { Project, SyntaxKind } from 'ts-morph'

const ROOT = path.resolve('src/app/commands')
const project = new Project({ tsConfigFilePath: 'tsconfig.json' })

const PERM_TIERS: Record<string, string> = {
  '(misc)': 'normal users - global player commands',
  '(mod)': 'moderators - admin / dev-guild commands'
}

let output = ''

function walk(dir: string, prefix = '') {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== 'README.md')
    .sort((a, b) => {
      const tierOrder = ['(misc)', '(mod)']
      const aTier = tierOrder.indexOf(a.name)
      const bTier = tierOrder.indexOf(b.name)
      if (aTier !== -1 || bTier !== -1) {
        if (aTier === -1) return 1
        if (bTier === -1) return -1
        return aTier - bTier
      }
      return a.name.localeCompare(b.name)
    })

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1
    const branch = isLast ? '└── ' : '├── '
    const nextPrefix = prefix + (isLast ? '    ' : '│   ')
    const fullPath = path.join(dir, entry.name)

    const permNote = PERM_TIERS[entry.name]
    output += `${prefix}${branch}${entry.name}`
    if (permNote) output += `  - ${permNote}`
    output += '\n'

    if (entry.isDirectory()) {
      walk(fullPath, nextPrefix)
      return
    }

    if (!entry.name.endsWith('.ts')) return

    const source = project.getSourceFile(fullPath)
    if (!source) return

    const dataVar = source.getVariableDeclaration('command')
    if (!dataVar) return

    const init = dataVar.getInitializerIfKind(
      SyntaxKind.ObjectLiteralExpression
    )
    if (!init) return

    const getText = (name: string) =>
      init
        .getProperty(name)
        ?.asKind(SyntaxKind.PropertyAssignment)
        ?.getInitializer()
        ?.getText()
        .replace(/['"`]/g, '')

    const cmdName = getText('name')
    const desc = getText('description')

    if (!cmdName) return

    output += `${nextPrefix}└─ /${cmdName}`
    if (desc) output += ` – ${desc}`
    output += '\n'

    const optionsProp = init
      .getProperty('options')
      ?.asKind(SyntaxKind.PropertyAssignment)

    const optionsInit = optionsProp
      ?.getInitializer()
      ?.asKind(SyntaxKind.ArrayLiteralExpression)

    if (!optionsInit) return

    optionsInit.getElements().forEach((el) => {
      if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) return

      const name = el
        .getProperty('name')
        ?.asKind(SyntaxKind.PropertyAssignment)
        ?.getInitializer()
        ?.getText()
        .replace(/['"`]/g, '')

      const desc = el
        .getProperty('description')
        ?.asKind(SyntaxKind.PropertyAssignment)
        ?.getInitializer()
        ?.getText()
        .replace(/['"`]/g, '')

      if (!name) return

      output += `${nextPrefix}   ├─ ${name}`
      if (desc) output += ` – ${desc}`
      output += '\n'
    })
  })
}

output += 'src/app/commands\n'
output += 'Permission tiers: (misc) = players | (mod) = moderators/admins\n\n'
walk(ROOT, '')

fs.writeFileSync('docs/COMMANDS_STRUCTURE.txt', output)
