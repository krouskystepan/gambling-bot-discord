export type MongoDuplicateKeyError = Error & {
  code: number
}
