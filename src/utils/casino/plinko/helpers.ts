export const dropPlinkoPath = (rows: number, bias = 0.5): number[] => {
  let pos = 0
  const path = [pos]

  for (let r = 1; r <= rows; r++) {
    if (Math.random() < bias) pos++
    pos = Math.max(0, Math.min(r, pos))
    path.push(pos)
  }

  return path
}

const BIN_SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'D', 'C', 'B', 'A']

export const renderBoardFrame = (
  rows: number,
  ballPos: number,
  step: number,
  binMultipliers: Record<number, number>
): string => {
  const H_SPACING = 0
  const spacer = ' '.repeat(H_SPACING)

  const width = rows * 2 + 1
  const centerCol = Math.floor(width / 2)

  const lines: string[] = []

  const startRow = Array(width).fill(' ')
  if (step === 0) startRow[centerCol] = '○'
  lines.push(startRow.join(spacer))

  for (let r = 0; r < rows; r++) {
    const row = Array(width).fill(' ')
    const left = centerCol - r

    for (let i = 0; i <= r; i++) {
      row[left + i * 2] = '•'
    }

    if (step === r + 1) {
      const gapCol = left + ballPos * 2 - 1
      if (gapCol >= 0 && gapCol < width) row[gapCol] = '○'
    }

    lines.push(row.join(spacer))
  }

  // Bottom bins
  const binRow = Array(width).fill(' ')
  const left = centerCol - rows

  for (let i = 0; i < BIN_SYMBOLS.length; i++) {
    const pegCol = left + i * 2 + 1
    const binCol = pegCol - 1

    if (pegCol >= 0 && pegCol < width) binRow[pegCol] = '|'
    if (binCol >= 0 && binCol < width) binRow[binCol] = BIN_SYMBOLS[i]
  }

  lines.push(binRow.join(spacer))

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
