import fs from 'fs'
import path from 'path'
import {
  type ArrayLiteralExpression,
  type CallExpression,
  type Expression,
  type Node,
  Project,
  SyntaxKind
} from 'ts-morph'

const DEFINITIONS_PATH = path.resolve('src/workers/workerDefinitions.ts')
const OUTPUT_PATH = path.resolve('docs/WORKERS_STRUCTURE.txt')

const KNOWN_MS: Record<string, number> = {
  SECOND_MS: 1000,
  MINUTE_MS: 60_000,
  HOUR_MS: 3_600_000,
  DAY_MS: 86_400_000
}

type WorkerLeaf = {
  fileName: string
  displayName: string
  description?: string
}

type ScheduleGroup = {
  header: string
  workers: WorkerLeaf[]
}

const project = new Project({ tsConfigFilePath: 'tsconfig.json' })
const source = project.getSourceFileOrThrow(DEFINITIONS_PATH)

const localMs = new Map<string, number>(Object.entries(KNOWN_MS))

for (const decl of source.getVariableDeclarations()) {
  const name = decl.getName()
  if (KNOWN_MS[name] !== undefined) continue
  const init = decl.getInitializer()
  if (!init) continue
  const ms = evalMs(init, localMs)
  if (ms !== undefined) localMs.set(name, ms)
}

function evalMs(
  expr: Expression,
  locals: Map<string, number>
): number | undefined {
  if (expr.isKind(SyntaxKind.Identifier)) {
    return locals.get(expr.getText())
  }

  if (expr.isKind(SyntaxKind.NumericLiteral)) {
    return Number(expr.getLiteralValue())
  }

  if (expr.isKind(SyntaxKind.ParenthesizedExpression)) {
    return evalMs(expr.getExpression(), locals)
  }

  if (expr.isKind(SyntaxKind.BinaryExpression)) {
    const left = evalMs(expr.getLeft(), locals)
    const right = evalMs(expr.getRight(), locals)
    if (left === undefined || right === undefined) return undefined
    switch (expr.getOperatorToken().getKind()) {
      case SyntaxKind.AsteriskToken:
        return left * right
      case SyntaxKind.PlusToken:
        return left + right
      case SyntaxKind.MinusToken:
        return left - right
      case SyntaxKind.SlashToken:
        return right === 0 ? undefined : left / right
      default:
        return undefined
    }
  }

  return undefined
}

function formatDuration(ms: number): string {
  const units: Array<{ label: string; size: number }> = [
    { label: 'd', size: KNOWN_MS.DAY_MS },
    { label: 'h', size: KNOWN_MS.HOUR_MS },
    { label: 'm', size: KNOWN_MS.MINUTE_MS },
    { label: 's', size: KNOWN_MS.SECOND_MS }
  ]

  for (const { label, size } of units) {
    if (ms % size === 0) {
      return `${ms / size}${label}`
    }
  }

  return `${ms}ms`
}

function jobSymbolToFileName(symbol: string): string {
  const base = symbol.endsWith('Job') ? symbol.slice(0, -3) : symbol
  return `${base}.job.ts`
}

function getLeadingCommentText(node: Node): string | undefined {
  const ranges = node.getLeadingCommentRanges()
  if (ranges.length === 0) return undefined

  const lines = ranges
    .map((range) => range.getText())
    .flatMap((text) => text.split('\n'))
    .map((line) =>
      line
        .replace(/^\/\//, '')
        .replace(/^\/\*/, '')
        .replace(/\*\/$/, '')
        .replace(/^\s*\*/, '')
        .trim()
    )
    .filter(Boolean)

  if (lines.length === 0) return undefined
  return lines.join(' ')
}

function parseWorkerEntries(
  workersArray: ArrayLiteralExpression,
  fallbackDescription?: string
): WorkerLeaf[] {
  return workersArray.getElements().flatMap((el, index) => {
    if (!el.isKind(SyntaxKind.ArrayLiteralExpression)) return []

    const [nameExpr, jobExpr] = el.getElements()
    if (!nameExpr || !jobExpr) return []

    const displayName = nameExpr.getText().replace(/^['"`]|['"`]$/g, '')
    const fileName = jobSymbolToFileName(jobExpr.getText())
    const description =
      getLeadingCommentText(el) ??
      (index === 0 ? fallbackDescription : undefined)

    return [{ fileName, displayName, description }]
  })
}

function unwrapScheduleEvery(
  call: CallExpression,
  startDelayMs?: number
): ScheduleGroup | undefined {
  const args = call.getArguments()
  if (args.length < 2) return undefined

  const intervalMs = evalMs(args[0] as Expression, localMs)
  if (intervalMs === undefined) return undefined

  const workersArg = args[1]
  if (!workersArg?.isKind(SyntaxKind.ArrayLiteralExpression)) return undefined

  const fallbackDescription = getLeadingCommentText(call)
  const workers = parseWorkerEntries(workersArg, fallbackDescription)
  if (workers.length === 0) return undefined

  let header = `every ${formatDuration(intervalMs)}`
  if (startDelayMs !== undefined) {
    header += ` (startDelay ${formatDuration(startDelayMs)})`
  }

  return { header, workers }
}

function parseTopLevelCall(call: CallExpression): ScheduleGroup | undefined {
  const name = call.getExpression().getText()

  if (name === 'scheduleEvery') {
    return unwrapScheduleEvery(call)
  }

  if (name !== 'withStartDelay') return undefined

  const args = call.getArguments()
  if (args.length < 2) return undefined

  const delayMs = evalMs(args[0] as Expression, localMs)
  if (delayMs === undefined) return undefined

  const inner = args[1]
  if (!inner?.isKind(SyntaxKind.CallExpression)) return undefined
  if (inner.getExpression().getText() !== 'scheduleEvery') return undefined

  // Comment may sit on withStartDelay's second arg (the scheduleEvery call).
  const group = unwrapScheduleEvery(inner, delayMs)
  if (!group) return undefined

  const delayComment = getLeadingCommentText(inner)
  if (delayComment && group.workers[0] && !group.workers[0].description) {
    group.workers[0] = {
      ...group.workers[0],
      description: delayComment
    }
  }

  return group
}

const definitionsDecl =
  source.getVariableDeclarationOrThrow('workerDefinitions')
const initializer = definitionsDecl.getInitializerIfKindOrThrow(
  SyntaxKind.ArrayLiteralExpression
)

const groups: ScheduleGroup[] = []

for (const element of initializer.getElements()) {
  if (!element.isKind(SyntaxKind.SpreadElement)) continue
  const expr = element.getExpression()
  if (!expr.isKind(SyntaxKind.CallExpression)) continue
  const group = parseTopLevelCall(expr)
  if (group) groups.push(group)
}

let output = ''
output += 'src/workers\n'
output +=
  'Source: src/workers/workerDefinitions.ts | jobs: src/workers/jobs\n\n'

groups.forEach((group, groupIndex) => {
  const groupLast = groupIndex === groups.length - 1
  const groupBranch = groupLast ? '└── ' : '├── '
  const groupChildPrefix = groupLast ? '    ' : '│   '

  output += `${groupBranch}${group.header}\n`

  group.workers.forEach((worker, workerIndex) => {
    const workerLast = workerIndex === group.workers.length - 1
    const workerBranch = workerLast ? '└── ' : '├── '
    const workerChildPrefix = groupChildPrefix + (workerLast ? '    ' : '│   ')

    output += `${groupChildPrefix}${workerBranch}${worker.fileName}\n`
    output += `${workerChildPrefix}└─ ${worker.displayName}`
    if (worker.description) output += ` – ${worker.description}`
    output += '\n'
  })
})

fs.writeFileSync(OUTPUT_PATH, output)
