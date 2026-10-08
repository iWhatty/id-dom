// @vitest-environment node
// ./test/late-dom.test.js
//
// A DOM installed after id-dom is imported (a test setup, a late jsdom, SSR
// then hydration) reaches every helper, and a DOM removed again behaves like
// the server. id-dom reads the global `document` and the element
// constructors on each lookup, never at import. Checked for the source and
// every shipped build.
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

const builds = [
  ['src', () => import('../src/id-dom.js')],
  ['dist/index.js', () => import('../dist/index.js')],
  ['dist/index.min.js', () => import('../dist/index.min.js')],
  ['dist/index.cjs', async () => require('../dist/index.cjs')],
]

const CONSTRUCTORS = ['HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLTextAreaElement',
  'HTMLSelectElement', 'HTMLFormElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLLabelElement',
  'HTMLCanvasElement', 'HTMLTemplateElement', 'SVGSVGElement', 'HTMLBodyElement']
const GLOBALS = ['document', ...CONSTRUCTORS]

const PAGE = '<!doctype html><body><button id="save"></button><div id="panel"></div>' +
  '<main id="app"></main><input id="email"></body>'

/** Install a jsdom window's document and element constructors as globals. */
function installDom() {
  const { window } = new JSDOM(PAGE)
  for (const name of GLOBALS) globalThis[name] = window[name]
  return window
}

function removeDom() {
  for (const name of GLOBALS) delete globalThis[name]
}

afterEach(removeDom)

describe.each(builds)('DOM installed after import: %s', (_name, load) => {
  it('starts without a DOM', async () => {
    await load()
    expect(typeof document).toBe('undefined')
    expect(typeof HTMLElement).toBe('undefined')
  })

  it('named helpers, byId and tag use the DOM installed after import', async () => {
    const m = await load()
    expect(() => m.button('save')).toThrow(/requires a DOM/)

    const window = installDom()
    expect(m.button('save')).toBeInstanceOf(window.HTMLButtonElement)
    expect(m.input.opt('email')).toBeInstanceOf(window.HTMLInputElement)
    expect(m.el('panel')).toBeInstanceOf(window.HTMLDivElement)
    expect(m.main('app').tagName).toBe('MAIN')
    expect(m.byId('save', window.HTMLButtonElement).id).toBe('save')
    expect(m.tag('app', 'main').id).toBe('app')
    expect(() => m.button('panel')).toThrow(/expected HTMLButtonElement/)
    expect(() => m.button('nope')).toThrow(/missing/)
    expect(m.div.optional('nope')).toBeNull()
  })

  it('the default dom object uses the DOM installed after import', async () => {
    const m = await load()
    expect(() => m.default.div('panel')).toThrow(/requires a DOM/)

    const window = installDom()
    expect(m.default.div('panel')).toBeInstanceOf(window.HTMLDivElement)
    expect(m.default.byId('save', window.HTMLButtonElement).id).toBe('save')
    expect(m.default.section.opt('nope')).toBeNull()
    expect(() => m.default.section.opt('app')).toThrow(/expected <section>/)
    expect(() => m.default.input('save')).toThrow(/expected HTMLInputElement/)
  })

  it('createDom() without a root uses the document of each lookup', async () => {
    const m = await load()
    const strict = m.createDom()
    const lenient = m.createDom(undefined, { mode: 'null' })
    expect(lenient.button('save')).toBeNull()

    const window = installDom()
    expect(strict.button('save')).toBeInstanceOf(window.HTMLButtonElement)
    expect(lenient.input('email')).toBeInstanceOf(window.HTMLInputElement)
    expect(lenient.input('nope')).toBeNull()

    const next = installDom() // a later document replaces the first one
    expect(strict.button('save')).toBe(next.document.getElementById('save'))
  })

  it('an explicit root stays the root after a DOM is installed', async () => {
    const m = await load()
    const container = new JSDOM('<div><input id="inner"></div>').window.document.body
    const scoped = m.createDom(container, { mode: 'null' })

    installDom()
    expect(scoped.button('save')).toBeNull() // in the global document, not the root
    expect(m.tag('inner', 'input', { root: container })).toBe(container.querySelector('input'))
  })

  it('a minimal stand-in DOM is enough (the dice3D-js repro)', async () => {
    const m = await load()
    class FakeElement {}
    const found = new FakeElement()
    globalThis.document = { getElementById: (id) => (id === 'x' ? found : null) }
    globalThis.HTMLElement = FakeElement

    expect(m.el('x')).toBe(found)
    expect(m.default.el('x')).toBe(found)
    expect(m.el.opt('y')).toBeNull()
  })

  it('a DOM removed again behaves like the server', async () => {
    const m = await load()
    installDom()
    expect(m.button('save').id).toBe('save')

    removeDom()
    expect(() => m.button('save')).toThrow(/requires a DOM/)
    expect(m.button.opt('save')).toBeNull()
    expect(() => m.default.button('save')).toThrow(/requires a DOM/)
    expect(m.createDom(undefined, { mode: 'null' }).button('save')).toBeNull()
    expect(m.default.button.opt).toBe(m.default.button.optional)
    expect(() => m.byId('save', class {})).toThrow(/missing/) // no document: nothing is found
    expect(m.byId.opt('save', class {})).toBeNull()
  })
})
