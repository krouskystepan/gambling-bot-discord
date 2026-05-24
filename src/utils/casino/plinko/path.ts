export const buildPlinkoPath = (
  rows: number,
  goRight: () => boolean
): number[] => {
  let pos = 0
  const path = [pos]

  for (let r = 1; r <= rows; r++) {
    if (goRight()) pos++
    pos = Math.max(0, Math.min(r, pos))
    path.push(pos)
  }

  return path
}
