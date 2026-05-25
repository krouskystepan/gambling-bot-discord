import { defineConfig } from 'commandkit/config'

export default defineConfig({
  compilerOptions: {
    tsdown: {
      // CommandKit defaults still set the deprecated top-level option; clear it so
      // only deps.skipNodeModulesBundle is passed to tsdown.
      skipNodeModulesBundle: undefined,
      deps: {
        skipNodeModulesBundle: true
      }
    }
  }
})
