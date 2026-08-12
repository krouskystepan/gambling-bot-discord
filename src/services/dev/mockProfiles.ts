import { randomInt } from './constants'

export type MockProfileIdentity = {
  username: string
  nickname: string
  avatarUrl: string
}

type RandomUserApiPerson = {
  login?: { username?: string }
  name?: { first?: string }
}

type RandomUserApiResponse = {
  results?: RandomUserApiPerson[]
}

const RANDOM_USER_API = 'https://randomuser.me/api/'
const MAX_RESULTS_PER_REQUEST = 100

function sanitizeUsername(raw: string, fallbackIndex: number): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 32)

  return cleaned.length >= 2 ? cleaned : `player${fallbackIndex}`
}

/** Single avatar host - unique image per seed. */
export function pravatarUrl(seed: string): string {
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`
}

function identityFromApiPerson(
  person: RandomUserApiPerson,
  index: number
): MockProfileIdentity {
  const username = sanitizeUsername(
    person.login?.username ?? `player${index}`,
    index
  )
  const nickname =
    person.name?.first?.trim() ||
    username.charAt(0).toUpperCase() + username.slice(1)

  return {
    username,
    nickname,
    avatarUrl: pravatarUrl(`${username}-${index}`)
  }
}

function fallbackIdentities(count: number): MockProfileIdentity[] {
  const identities: MockProfileIdentity[] = []

  for (let i = 0; i < count; i++) {
    const username = `player${randomInt(1000, 999_999)}`
    identities.push({
      username,
      nickname: username.charAt(0).toUpperCase() + username.slice(1),
      avatarUrl: pravatarUrl(`${username}-${i}`)
    })
  }

  return identities
}

/**
 * Fetches usernames from randomuser.me, avatars from pravatar.cc (one image host).
 */
export async function fetchMockProfileIdentities(
  count: number
): Promise<MockProfileIdentity[]> {
  if (count <= 0) return []

  const identities: MockProfileIdentity[] = []

  try {
    while (identities.length < count) {
      const batchSize = Math.min(
        count - identities.length,
        MAX_RESULTS_PER_REQUEST
      )
      const url = new URL(RANDOM_USER_API)
      url.searchParams.set('results', String(batchSize))
      url.searchParams.set('inc', 'login,name')
      url.searchParams.set('noinfo', 'true')

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`randomuser.me HTTP ${response.status}`)
      }

      const data = (await response.json()) as RandomUserApiResponse
      const results = data.results ?? []
      if (results.length === 0) {
        throw new Error('randomuser.me returned no results')
      }

      for (const person of results) {
        if (identities.length >= count) break
        identities.push(identityFromApiPerson(person, identities.length))
      }
    }

    return identities
  } catch {
    return fallbackIdentities(count)
  }
}
