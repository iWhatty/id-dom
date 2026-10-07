// ./build.js
//
// Builds distributable variants:
//  - dist/index.js      (ESM + sourcemap)
//  - dist/index.min.js  (ESM minified)
//  - dist/index.cjs     (CommonJS)
//
// Every build keeps the source's pure-call annotations, so a consumer's
// bundler can drop the helpers it does not import. esbuild keeps them in
// unminified output, but whitespace minification drops all comments; for
// the minified build they are put back at the positions the sourcemap gives
// for each annotated call (see restorePureAnnotations).

import { build } from 'esbuild'
import { readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'

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

/** The annotation as written in the source, before the call it marks. */
const PURE_IN_SOURCE = '/* @__PURE__ */ '

/** The annotation as inserted into minified output. */
const PURE_IN_MIN = '/*@__PURE__*/'

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
 * 0-based [line, column] of each call the source marks pure: the position
 * right after the annotation.
 * @param {string} source
 * @returns {Array<[number, number]>}
 */
const pureCallSites = source => {
  /** @type {Array<[number, number]>} */
  const sites = []
  for (let at = source.indexOf(PURE_IN_SOURCE); at !== -1; at = source.indexOf(PURE_IN_SOURCE, at + 1)) {
    const call = at + PURE_IN_SOURCE.length
    const lineStart = source.lastIndexOf('\n', call - 1) + 1
    sites.push([source.slice(0, lineStart).split('\n').length - 1, call - lineStart])
  }
  return sites
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Decode sourcemap `mappings` into [generatedLine, generatedColumn,
 * sourceLine, sourceColumn] segments (all 0-based).
 * @param {string} mappings
 * @returns {Array<[number, number, number, number]>}
 */
const decodeMappings = mappings => {
  /** @type {Array<[number, number, number, number]>} */
  const segments = []
  let sourceLine = 0
  let sourceColumn = 0
  mappings.split(';').forEach((line, generatedLine) => {
    let generatedColumn = 0
    for (const segment of line.split(',')) {
      if (!segment) continue
      /** @type {number[]} */
      const fields = []
      let value = 0
      let shift = 0
      for (const ch of segment) {
        const digit = BASE64.indexOf(ch)
        value += (digit & 31) << shift
        if (digit & 32) {
          shift += 5
        } else {
          fields.push(value & 1 ? -(value >>> 1) : value >>> 1)
          value = 0
          shift = 0
        }
      }
      generatedColumn += fields[0]
      if (fields.length >= 4) {
        sourceLine += fields[2]
        sourceColumn += fields[3]
        segments.push([generatedLine, generatedColumn, sourceLine, sourceColumn])
      }
    }
  })
  return segments
}

/**
 * Insert a pure annotation before each call the source marks pure, at the
 * generated position the sourcemap gives for it. Throws unless every marked
 * call maps to exactly one position, so a change in esbuild's output fails
 * the build instead of shipping a minified file that cannot be tree-shaken.
 * @param {string} code minified output
 * @param {string} map its sourcemap (JSON)
 * @param {string} source the entry source
 * @returns {string}
 */
const restorePureAnnotations = (code, map, source) => {
  const segments = decodeMappings(JSON.parse(map).mappings)
  const lineStarts = [0]
  for (let i = code.indexOf('\n'); i !== -1; i = code.indexOf('\n', i + 1)) lineStarts.push(i + 1)

  const offsets = pureCallSites(source).map(([line, column]) => {
    const found = new Set(segments
      .filter(([, , sourceLine, sourceColumn]) => sourceLine === line && sourceColumn === column)
      .map(([generatedLine, generatedColumn]) => lineStarts[generatedLine] + generatedColumn))
    if (found.size !== 1) {
      throw new Error(`pure call at ${SRC}:${line + 1}:${column + 1} maps to ${found.size} positions in the minified output`)
    }
    return [...found][0]
  })

  let annotated = code
  for (const offset of [...new Set(offsets)].sort((a, b) => b - a)) {
    annotated = annotated.slice(0, offset) + PURE_IN_MIN + annotated.slice(offset)
  }
  return annotated
}

/**
 * Build one variant. A minified variant is built in memory with a sourcemap,
 * which is used to restore the pure annotations and then discarded.
 * @param {{ file: string } & import('esbuild').BuildOptions} variant
 * @returns {Promise<void>}
 */
const buildVariant = async ({ file, ...config }) => {
  if (!config.minify) {
    await build({ ...baseConfig, outfile: out(file), ...config })
    return
  }

  const result = await build({ ...baseConfig, outfile: out(file), ...config, sourcemap: 'external', write: false })
  const output = name => result.outputFiles.find(f => f.path.endsWith(name))
  const code = output(file).text
  const map = output(`${file}.map`).text
  const annotated = restorePureAnnotations(code, map, readFileSync(SRC, 'utf8'))
  // esbuild ends the file with a sourceMappingURL comment for the discarded map.
  writeFileSync(out(file), annotated.replace(/\/\/# sourceMappingURL=\S+\s*$/, ''))
}

/**
 * Build all output variants.
 * Cleans and recreates the output directory before building.
 * @returns {Promise<void>}
 */
const buildAll = async () => {
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })

  await Promise.all(variants.map(buildVariant))
}

try {
  await buildAll()
  console.log(`✓ Built ${OUT_DIR}/`)
} catch (err) {
  console.error('✗ Build failed')
  console.error(err)
  process.exitCode = 1
}
