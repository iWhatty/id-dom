// @vitest-environment node
// ./test/ssr.test.js
//
// Server-side (no DOM) behaviour, for the source and for every shipped build.
// With no DOM, a typed helper (`input`, `button`, ...) cannot check its type,
// so its base call throws a clear "requires a DOM" error in a 'throw' scope
// and returns null in a 'null' scope; `.optional` / `.opt` return null. Every
// helper the types promise must exist and be callable: on the named exports,
// on the default `dom` object, and on every `createDom()` scope.
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

const builds = [
  ['src', () => import('../src/id-dom.js')],
  ['dist/index.js', () => import('../dist/index.js')],
  ['dist/index.min.js', () => import('../dist/index.min.js')],
  ['dist/index.cjs', async () => require('../dist/index.cjs')],
]

const TYPED = ['el', 'input', 'button', 'textarea', 'select', 'form', 'div', 'span',
  'label', 'canvas', 'template', 'svg', 'body']
const TAGGED = ['main', 'section', 'small']
const HELPERS = ['byId', 'tag', ...TYPED, ...TAGGED]

/** A root that has no elements, as a server-side document stand-in would. */
const emptyRoot = { getElementById: () => null }

describe.each(builds)('without a DOM: %s', (_name, load) => {
  it('has no DOM globals in this environment', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof HTMLElement).toBe('undefined')
  })

  it('exposes every helper as a function on dom and on createDom scopes', async () => {
    const m = await load()
    const scopes = {
      dom: m.default,
      throwScope: m.createDom(emptyRoot),
      nullScope: m.createDom(emptyRoot, { mode: 'null' }),
    }
    for (const [scope, api] of Object.entries(scopes)) {
      for (const name of HELPERS) {
        expect(typeof api[name], `${scope}.${name}`).toBe('function')
        expect(typeof api[name].optional, `${scope}.${name}.optional`).toBe('function')
        expect(api[name].opt, `${scope}.${name}.opt is .optional`).toBe(api[name].optional)
      }
    }
  })

  it('typed helpers throw "requires a DOM" in throw scopes', async () => {
    const m = await load()
    for (const name of TYPED) {
      expect(() => m[name]('x'), `named ${name}`).toThrow(/requires a DOM/)
      expect(() => m.default[name]('x'), `dom.${name}`).toThrow(/requires a DOM/)
      expect(() => m.createDom(emptyRoot)[name]('x'), `scoped ${name}`).toThrow(/requires a DOM/)
    }
  })

  it('the "requires a DOM" error is an IdDomError with reason no-dom', async () => {
    const m = await load()
    let caught
    try { m.button('save') } catch (err) { caught = err }
    expect(caught).toBeInstanceOf(m.IdDomError)
    expect(caught).toMatchObject({ name: 'IdDomError', reason: 'no-dom', id: 'save' })
  })

  it('typed helpers return null in null scopes and from .optional / .opt', async () => {
    const m = await load()
    const nullScope = m.createDom(emptyRoot, { mode: 'null' })
    for (const name of TYPED) {
      expect(nullScope[name]('x'), `null-scope ${name}`).toBeNull()
      expect(m[name].opt('x'), `named ${name}.opt`).toBeNull()
      expect(m.default[name].optional('x'), `dom.${name}.optional`).toBeNull()
      expect(m.createDom(emptyRoot)[name].opt('x'), `scoped ${name}.opt`).toBeNull()
    }
  })
})
