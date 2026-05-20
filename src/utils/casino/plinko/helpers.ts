import { buildPlinkoPath } from './path'

export const dropPlinkoPath = (rows: number, bias = 0.5): number[] =>
  buildPlinkoPath(rows, () => Math.random() < bias)

export const renderBoardFrame = (
  rows: number,
  paths: number[][],
  globalStep: number,
  spawnDelay: number,
  binMultipliers: Record<number, number>
): string => {
  const width = rows * 2 + 1
  const centerCol = Math.floor(width / 2)
  const lines: string[] = []
  const spacer = ''

  // Top spawn row
  const startRow = Array(width).fill(' ')
  for (let i = 0; i < paths.length; i++) {
    const startStep = i * spawnDelay
    if (globalStep === startStep) {
      startRow[centerCol] = '●'
    }
  }
  lines.push(startRow.join(spacer))

  // Precompute ball positions at this step
  const ballPositions: Array<{ row: number; pos: number } | null> = paths.map(
    (path, ballIndex) => {
      const startStep = ballIndex * spawnDelay
      const localStep = globalStep - startStep

      if (localStep < 0 || localStep >= path.length) return null

      return {
        row: localStep,
        pos: path[localStep]
      }
    }
  )

  for (let r = 0; r < rows; r++) {
    const row = Array(width).fill(' ')
    const left = centerCol - r

    // Pegs
    for (let i = 0; i <= r; i++) {
      row[left + i * 2] = '•'
    }

    // Balls
    for (const ball of ballPositions) {
      if (!ball) continue
      if (ball.row === r + 1) {
        const gapCol = left + ball.pos * 2 - 1
        if (gapCol >= 0 && gapCol < width) row[gapCol] = '●'
      }
    }

    lines.push(row.join(spacer))
  }

  // Bins
  const BIN_SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'D', 'C', 'B', 'A']
  const binRow = Array(width).fill(' ')
  const left = centerCol - rows

  for (let i = 0; i < BIN_SYMBOLS.length; i++) {
    const pegCol = left + i * 2 + 1
    const binCol = pegCol - 1
    if (pegCol >= 0 && pegCol < width) binRow[pegCol] = '|'
    if (binCol >= 0 && binCol < width) binRow[binCol] = BIN_SYMBOLS[i]
  }

  lines.push(binRow.join(spacer))

  // Legend
  const legend: string[] = ['Legend:']
  const seen = new Set<string>()

  for (let i = 0; i < BIN_SYMBOLS.length; i++) {
    const symbol = BIN_SYMBOLS[i]
    if (seen.has(symbol)) continue
    seen.add(symbol)

    const mult = binMultipliers[i] ?? 0
    legend.push(`**${symbol}** x${mult.toFixed(2)}`)
  }

  return `\`\`\`${lines.join('\n')}\`\`\`${legend.join('\n')}`
}
