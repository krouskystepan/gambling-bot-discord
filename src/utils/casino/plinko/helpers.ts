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

const getBinSymbol = (mult: number): string => {
  if (mult >= 5) return 'U' // diamond
  if (mult >= 2) return 'V' // green tier
  if (mult >= 1) return 'X' // yellow tier
  if (mult >= 0.5) return 'Y' // orange tier
  return 'Z' // red tier
}

export const renderBoardFrame = (
  rows: number,
  ballPos: number,
  step: number,
  binMultipliers: Record<number, number>
): string => {
  const H_SPACING = 1
  const spacer = ' '.repeat(H_SPACING)

  const width = rows * 2 + 1
  const centerCol = Math.floor(width / 2)

  const lines: string[] = []

  // 🔵 Ball start above board
  const startRow = Array(width).fill(' ')
  if (step === 0) startRow[centerCol] = '○'
  lines.push(startRow.join(spacer))

  // 🔻 Peg rows
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

  // 🎯 Bottom bins — pegs + symbols in the gaps (TRUE bin positions)
  const binRow = Array(width).fill(' ')
  const left = centerCol - rows

  for (let i = 0; i <= rows; i++) {
    const pegCol = left + i * 2 + 1 // peg positions (keep these)
    const binCol = pegCol - 1 // gap BEFORE each peg = bin

    // draw peg markers
    if (pegCol >= 0 && pegCol < width) {
      binRow[pegCol] = '|'
    }

    // draw bin symbol in the gap
    if (binCol >= 0 && binCol < width) {
      binRow[binCol] = getBinSymbol(binMultipliers[i] ?? 0)
    }
  }

  lines.push(binRow.join(spacer))

  // 📖 LEGEND — GENERATED FROM CONFIG
  const uniqueTiers = [...new Set(Object.values(binMultipliers))].sort(
    (a, b) => b - a
  )

  const legend: string[] = []

  legend.push('')
  legend.push('Legend:')

  for (const mult of uniqueTiers) {
    legend.push(`**${getBinSymbol(mult)}** x${mult.toFixed(2)}`)
  }

  return `\`\`\`${lines.join('\n')}\`\`\`${legend.join('\n')}`
}
