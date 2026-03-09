import fs from 'fs'
import path from 'path'
import { Project, SyntaxKind } from 'ts-morph'

const ROOT = path.resolve('src/app/commands')
const project = new Project({ tsConfigFilePath: 'tsconfig.json' })

let output = ''

function walk(dir: string, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1
    const branch = isLast ? '└── ' : '├── '
    const nextPrefix = prefix + (isLast ? '    ' : '│   ')
    const fullPath = path.join(dir, entry.name)

    output += `${prefix}${branch}${entry.name}\n`

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

output += 'src\n'
walk(ROOT, '')

fs.writeFileSync('docs/COMMANDS_STRUCTURE.txt', output)
