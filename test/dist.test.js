// ./test/dist.test.js
//
// Test what ships: the built files in dist/ (`npm test` builds first).
// - Each build (ESM, minified ESM, CommonJS) keeps the core contract in a
//   browser-like DOM (jsdom).
// - No build reads a free Node global. A browser bundler that sees one may
//   inject or auto-install a polyfill; `typeof process` counts, since that
//   is how nanotypes 0.2.2 shipped one. Property names, strings and names a
//   file declares itself are not matches.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const dist = (file) => require.resolve(`../dist/${file}`)

const builds = [
  ['index.js', () => import('../dist/index.js')],
  ['index.min.js', () => import('../dist/index.min.js')],
  ['index.cjs', async () => require('../dist/index.cjs')],
]

describe.each(builds)('dist/%s', (_file, load) => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="saveBtn"></button><div id="panel"></div><main id="app"></main>'
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('throw-mode helpers return the element or throw', async () => {
    const m = await load()
    expect(m.button('saveBtn')).toBeInstanceOf(HTMLButtonElement)
    expect(m.default.button('saveBtn')).toBeInstanceOf(HTMLButtonElement)
    expect(m.byId('saveBtn', HTMLButtonElement)).toBeInstanceOf(HTMLButtonElement)
    expect(m.tag('app', 'main').id).toBe('app')
    expect(() => m.button('nope')).toThrow(/missing/)
    expect(() => m.default.button('panel')).toThrow(/expected HTMLButtonElement/)
  })

  it('null-mode scopes return null; .optional / .opt return null only when missing', async () => {
    const m = await load()
    const scope = m.createDom(document, { mode: 'null' })
    expect(scope.button('nope')).toBeNull()
    expect(scope.button('panel')).toBeNull()
    expect(scope.div('panel')).toBeInstanceOf(HTMLDivElement)
    expect(m.byId.opt).toBe(m.byId.optional)
    expect(m.byId.opt('nope', HTMLButtonElement)).toBeNull()
    expect(() => m.byId.opt('panel', HTMLButtonElement)).toThrow(m.IdDomError)
    expect(() => m.tag.optional('app', 'section')).toThrow(m.IdDomError)
    expect(m.div.opt('nope')).toBeNull()
  })

  it('rejects an invalid mode with IdDomError reason invalid-mode', async () => {
    const m = await load()
    expect(() => m.createDom(document, { mode: 'nul' })).toThrow(m.IdDomError)
    expect(() => m.byId('panel', HTMLDivElement, { mode: 'nul' })).toThrow(/invalid mode 'nul'/)
  })

  it('scopes to a ShadowRoot and an Element root', async () => {
    const m = await load()
    const host = document.createElement('div')
    host.attachShadow({ mode: 'open' }).innerHTML = '<input id="inShadow">'
    const container = document.createElement('section')
    container.innerHTML = '<input id="inContainer">'

    expect(m.createDom(host.shadowRoot).input('inShadow')).toBeInstanceOf(HTMLInputElement)
    expect(m.createDom(container).input('inContainer')).toBeInstanceOf(HTMLInputElement)
    expect(m.createDom(container, { mode: 'null' }).input('saveBtn')).toBeNull()
  })
})

const NODE_GLOBALS = new Set(['process', 'Buffer', 'global', 'setImmediate', 'clearImmediate',
  '__dirname', '__filename', 'require', 'module', 'exports'])

/**
 * Free references to Node globals in a JavaScript file.
 * @param {string} code
 * @returns {string[]}
 */
function freeNodeGlobals(code) {
  const source = ts.createSourceFile('file.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const declared = new Set()
  const used = []
  const visit = (node) => {
    if (ts.isIdentifier(node) && NODE_GLOBALS.has(node.text)) {
      const parent = node.parent
      const isPropertyName = parent.name === node && (ts.isPropertyAccessExpression(parent) ||
        ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent))
      const isDeclaration = parent.name === node && (ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) || ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent))
      if (isDeclaration) declared.add(node.text)
      else if (!isPropertyName) used.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return used.filter((name) => !declared.has(name))
}

describe('no free Node globals', () => {
  it('the scan finds typeof checks and ignores properties, strings and local names', () => {
    expect(freeNodeGlobals('typeof process<"u"&&!1')).toEqual(['process'])
    expect(freeNodeGlobals('Buffer.from(x); setImmediate(f)')).toEqual(['Buffer', 'setImmediate'])
    expect(freeNodeGlobals('o.process; ({ global: 1 }); "require"; function f(module) { module.x }')).toEqual([])
  })

  it.each([
    ['index.js', []],
    ['index.min.js', []],
    ['index.cjs', ['module']], // `module.exports = ...` is how CommonJS exports
  ])('dist/%s reads no Node global (CommonJS may use %j)', (file, allowed) => {
    const used = freeNodeGlobals(readFileSync(dist(file), 'utf8'))
    expect(used.filter((name) => !allowed.includes(name))).toEqual([])
  })
})
