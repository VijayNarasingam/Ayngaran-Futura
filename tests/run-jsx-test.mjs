/**
 * Runs a test that imports .jsx source.
 *
 * The resource modules under test are React JSX, which plain `node` cannot
 * import (ERR_UNKNOWN_FILE_EXTENSION). Rather than add a bundler dependency,
 * reuse the one the app already has: bundle the test through Vite's SSR build
 * and run the output. External deps stay external, so React resolves normally.
 *
 * Usage: node tests/run-jsx-test.mjs tests/form-payload.mjs
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = process.argv[2]
if (!entry) {
  console.error('usage: node tests/run-jsx-test.mjs <test-file>')
  process.exit(2)
}

const entryPath = path.resolve(root, entry)
const outDir = path.join(root, 'tests', '.tmp')
const outFile = path.join(outDir, path.basename(entry).replace(/\.mjs$/, '') + '.mjs')

await fs.rm(outDir, { recursive: true, force: true })

await build({
  root,
  logLevel: 'error',
  configFile: false,
  build: {
    ssr: entryPath,
    outDir,
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    rollupOptions: { output: { entryFileNames: path.basename(outFile) } },
  },
})

await import(pathToFileURL(outFile).href)
await fs.rm(outDir, { recursive: true, force: true })