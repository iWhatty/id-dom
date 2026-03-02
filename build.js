// build.js
//
// Production build script for dom-id.
//
// Outputs:
//  - dist/dom-id.js       (ESM + sourcemap)
//  - dist/dom-id.min.js   (ESM minified)
//  - dist/dom-id.cjs      (CommonJS)
//
// Zero deps. Modern target.

import { build } from 'esbuild'
import { rmSync, mkdirSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist')

await build({
  entryPoints: ['src/dom-id.js'],
  outfile: 'dist/dom-id.js',
  format: 'esm',
  bundle: false,
  sourcemap: true,
  target: 'es2020'
})

await build({
    entryPoints: ['src/dom-id.js'],
  outfile: 'dist/dom-id.min.js',
  format: 'esm',
  bundle: false,
  minify: true,
  target: 'es2020'
})

await build({
    entryPoints: ['src/dom-id.js'],
  outfile: 'dist/dom-id.cjs',
  format: 'cjs',
  bundle: false,
  sourcemap: true,
  target: 'es2020'
})

console.log('✓ Built dist/')