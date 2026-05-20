/**
 * Fail tests on unexpected process warnings (e.g. deprecations).
 */
const warningPattern =
  /MONGOOSE|DeprecationWarning|eslint-disable|ExperimentalWarning/

process.on('warning', (warning) => {
  if (warningPattern.test(warning.name) || warningPattern.test(warning.message)) {
    throw new Error(`Unexpected warning: ${warning.message}`)
  }
})
