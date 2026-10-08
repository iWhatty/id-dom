// @vitest-environment node
// ./test/tree-shake.test.js
//
// A consumer that imports one helper gets only that helper and the lookup
// core: not the other helpers, not the default `dom` object, not
// `createDom`. Each ES module build is bundled the way an app bundler would
// (esbuild: bundle, minify, tree shaking), imported by file path so the
// package's `sideEffects: false` does not help: the pure-call annotations in
// the build must do it. Checked by gzip budget and by markers: strings only
// the dropped code contains (survive minification) and, for the unminified
// build, function names.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))

const CONSTRUCTORS = ['HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLTextAreaElement',
  'HTMLSelectElement', 'HTMLFormElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLLabelElement',
  'HTMLCanvasElement', 'HTMLTemplateElement', 'SVGSVGElement', 'HTMLBodyElement']
const TAGS = ['"main"', '"section"', '"small"']
const TAG_CODE = 'invalid tagName' // tag()
const TYPE_CODE = 'invalid Type' // byId()
const SSR_SHIM = 'requires a DOM' // typed helpers

/**
 * Gzip budgets (level 9, bytes) for the minified consumer bundle. 0.0.7: about 2,100 for each.
 * They catch a tree-shaking regression, not a few bytes of message: 0.0.9 raised `main` from
 * 1,270 to 1,300 for its new error text (the '#' hint, the tagName in an invalid-tagName error);
 * 0.2.0 raised each by about 200: about 100 for the exported IdDomError class (reason, id) and
 * its wiring, about 100 for mode validation (reason 'invalid-mode') and the .opt flag.
 */
const BUDGET = { button: 1700, byId: 1450, main: 1475, dom: 2125 }

/**
 * Bundle a consumer of a dist file as an app bundler would.
 * @param {string} file dist file
 * @param {string} source consumer, importing from `ID_DOM`
 * @param {boolean} [minifyIdentifiers]
 */
async function bundle(file, source, minifyIdentifiers = true) {
  const result = await build({
    stdin: { contents: source.replace('ID_DOM', JSON.stringify(`./${file}`)), resolveDir: distDir },
    bundle: true,
    // `minify` implies minifyIdentifiers; name markers need names kept.
    ...(minifyIdentifiers ? { minify: true } : { minifyWhitespace: true, minifySyntax: true }),
    treeShaking: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  return { code, gzip: gzipSync(code, { level: 9 }).length }
}

const without = (code, markers) => markers.filter((marker) => code.includes(marker))

describe.each(['index.js', 'index.min.js'])('tree shaking dist/%s', (file) => {
  it('keeps every pure-call annotation of the source', () => {
    const count = (code) => code.match(/[@#]__PURE__/g)?.length ?? 0
    const source = count(readFileSync(new URL('../src/id-dom.js', import.meta.url), 'utf8'))
    expect(source).toBeGreaterThan(16)
    expect(count(readFileSync(`${distDir}${file}`, 'utf8'))).toBe(source)
  })

  it('{ button } bundles only button and the lookup core', async () => {
    const { code, gzip } = await bundle(file, 'import { button } from ID_DOM; button("save").click()')
    expect(code).toContain('HTMLButtonElement')
    expect(code).toContain(SSR_SHIM)
    expect(without(code, CONSTRUCTORS.filter((name) => name !== 'HTMLButtonElement'))).toEqual([])
    expect(without(code, [...TAGS, TAG_CODE])).toEqual([])
    expect(gzip).toBeLessThanOrEqual(BUDGET.button)
  })

  it('{ byId } bundles no helper, no tag() and no SSR shim', async () => {
    const { code, gzip } = await bundle(file, 'import { byId } from ID_DOM; byId("save", HTMLElement).click()')
    expect(code).toContain(TYPE_CODE)
    expect(without(code, [...CONSTRUCTORS.filter((name) => name !== 'HTMLElement'), ...TAGS, TAG_CODE, SSR_SHIM]))
      .toEqual([])
    expect(gzip).toBeLessThanOrEqual(BUDGET.byId)
  })

  it('{ main } bundles tag() but not byId() or a typed helper', async () => {
    const { code, gzip } = await bundle(file, 'import { main } from ID_DOM; main("app").remove()')
    expect(code).toContain(TAG_CODE)
    expect(without(code, [...CONSTRUCTORS, '"section"', '"small"', TYPE_CODE, SSR_SHIM])).toEqual([])
    expect(gzip).toBeLessThanOrEqual(BUDGET.main)
  })

  // Names kept: minified identifiers are assigned by use counts, which the
  // consumer's own names can shift without changing the code.
  it('an aliased named import bundles the same code as the plain one', async () => {
    const plain = await bundle(file, 'import { button } from ID_DOM; button("save").click()', false)
    const aliased = await bundle(file, 'import { button as buttonEl } from ID_DOM; buttonEl("save").click()', false)
    expect(aliased.code).toBe(plain.code)
  })

  // `import * as dom` reads like the default object (`dom.el`, `dom.button.opt`)
  // but is a namespace, so a bundler keeps only the members used.
  it('import * as dom bundles the same code as the named imports it uses', async () => {
    const named = await bundle(file, 'import { el, button } from ID_DOM; el("a").click(); button.opt("b")', false)
    const star = await bundle(file, 'import * as dom from ID_DOM; dom.el("a").click(); dom.button.opt("b")', false)
    expect(star.code).toBe(named.code)

    const { code, gzip } = await bundle(file, 'import * as dom from ID_DOM; dom.el("a").click(); dom.button.opt("b")')
    expect(without(code, [...CONSTRUCTORS.filter((n) => n !== 'HTMLElement' && n !== 'HTMLButtonElement'),
      ...TAGS, TAG_CODE])).toEqual([])
    expect(gzip).toBeLessThanOrEqual(BUDGET.button)
  })

  it('the default dom object still bundles every helper', async () => {
    const { code, gzip } = await bundle(file, 'import dom from ID_DOM; dom.button("save").click()')
    for (const name of [...CONSTRUCTORS, TAG_CODE, TYPE_CODE, SSR_SHIM]) expect(code).toContain(name)
    expect(gzip).toBeLessThanOrEqual(BUDGET.dom)
  })
})

describe('tree shaking dist/index.js, by function name', () => {
  const DROPPED_FOR_ONE_HELPER = ['createDom', 'defaultTagHelper', 'makeTagHelper', 'tagOptional',
    'tagWithOptional', 'TYPE_HELPERS', 'TAG_HELPERS']

  it('{ button } drops createDom, the registries and the tag helpers', async () => {
    const { code } = await bundle('index.js', 'import { button } from ID_DOM; button("save").click()', false)
    expect(code).toContain('defaultTypedHelper')
    expect(without(code, DROPPED_FOR_ONE_HELPER)).toEqual([])
  })

  it('{ byId } drops every helper builder', async () => {
    const { code } = await bundle('index.js', 'import { byId } from ID_DOM; byId("save", HTMLElement).click()', false)
    expect(without(code, [...DROPPED_FOR_ONE_HELPER, 'defaultTypedHelper', 'makeTypedHelper', 'domConstructor']))
      .toEqual([])
  })
})
