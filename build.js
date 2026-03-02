// ./build.js
//
// Builds distributable variants:
//  - dist/dom-id.js      (ESM + sourcemap)
//  - dist/dom-id.min.js  (ESM minified)
//  - dist/dom-id.cjs     (CommonJS)

import { build } from 'esbuild'
import { rmSync, mkdirSync } from 'node:fs'

/** Entry file */
const SRC = 'src/dom-id.js'

/** Output directory */
const OUT_DIR = 'dist'

/** ECMAScript target */
const TARGET = 'es2020'

/** @type {'esm'} */
const ESM = 'esm'

/** @type {'cjs'} */
const CJS = 'cjs'

/** @type {import('esbuild').BuildOptions} */
const baseConfig = {
  entryPoints: [SRC],
  bundle: false,
  target: TARGET,
  platform: 'neutral',
}

/**
 * Resolve output file path.
 * @param {string} name
 * @returns {string}
 */
const out = name => `${OUT_DIR}/${name}`

/**
 * Build matrix describing output variants.
 * @type {Array<
 *   { file: string } & import('esbuild').BuildOptions
 * >}
 */
const variants = [
  { file: 'dom-id.js', format: ESM, sourcemap: true },
  { file: 'dom-id.min.js', format: ESM, minify: true },
  { file: 'dom-id.cjs', format: CJS, sourcemap: true }
]

/**
 * Build all output variants.
 * Cleans and recreates the output directory before building.
 * @returns {Promise<void>}
 */
const buildAll = async () => {
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })

  await Promise.all(
    variants.map(({ file, ...config }) =>
      build({
        ...baseConfig,
        outfile: out(file),
        ...config
      })
    )
  )
}

try {
  await buildAll()
  console.log(`✓ Built ${OUT_DIR}/`)
} catch (err) {
  console.error('✗ Build failed')
  console.error(err)
  process.exitCode = 1
}