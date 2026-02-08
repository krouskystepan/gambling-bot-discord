const userCooldowns = new Map<string, number>()
const COOLDOWN_MS = 2500

export function isUserOnCooldown(userId: string) {
  const now = Date.now()
  const expires = userCooldowns.get(userId) ?? 0

  if (now < expires) return true

  userCooldowns.set(userId, now + COOLDOWN_MS)
  return false
}
