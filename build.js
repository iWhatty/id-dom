// ./build.js
//
// Builds distributable variants:
//  - dist/index.js      (ESM + sourcemap)
//  - dist/index.min.js  (ESM minified)
//  - dist/index.cjs     (CommonJS)

import { build } from 'esbuild'
import { rmSync, mkdirSync } from 'node:fs'

/** Entry file */
const SRC = 'src/id-dom.js'

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
  { file: 'index.js', format: ESM, sourcemap: true },
  { file: 'index.min.js', format: ESM, minify: true },
  { file: 'index.cjs', format: CJS, sourcemap: true }
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