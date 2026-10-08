// @vitest-environment node
// ./test/package.test.js
//
// package.json `exports` as Node resolves it, by package name (Node resolves
// a package's own name from inside it through `exports`, as it would from a
// consumer's node_modules). Some tools read `<package>/package.json`, which
// `exports` blocks unless it lists it.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/** Run an ES module snippet in a fresh Node process from the package root. */
const runModule = (code) =>
  execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8' }).trim()

describe('package.json exports', () => {
  it('require("id-dom/package.json") resolves to this package.json', () => {
    expect(require.resolve('id-dom/package.json')).toBe(require.resolve('../package.json'))
    expect(require('id-dom/package.json').version).toBe(pkg.version)
  })

  it('import "id-dom/package.json" (JSON module) resolves', () => {
    const version = runModule(
      "const { default: p } = await import('id-dom/package.json', { with: { type: 'json' } }); console.log(p.version)")
    expect(version).toBe(pkg.version)
  })

  it('every exports target is a file the package ships', () => {
    /** @type {(v: unknown) => string[]} */
    const targets = (v) => (typeof v === 'string' ? [v] : Object.values(/** @type {object} */ (v)).flatMap(targets))
    for (const target of targets(pkg.exports)) {
      const shipped = target === './package.json' || pkg.files.some((entry) => target.startsWith(`./${entry}/`))
      expect(shipped, target).toBe(true)
    }
  })
})
