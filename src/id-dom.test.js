// dom-id.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import dom, { byId, tag, createDom } from './id-dom.js'

describe('dom-id', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="saveBtn">Save</button>
      <input id="nameInput" />
      <div id="debugPanel"></div>
      <main id="appMain"></main>
      <section id="hero"></section>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('default export is strict: returns typed element when correct', () => {
    const btn = dom.button('saveBtn')
    expect(btn).toBeInstanceOf(HTMLButtonElement)

    const input = dom.input('nameInput')
    expect(input).toBeInstanceOf(HTMLInputElement)
  })

  it('default export is strict: throws on missing id', () => {
    expect(() => dom.button('nope')).toThrow(/missing/i)
  })

  it('default export is strict: throws on wrong type', () => {
    // debugPanel is a DIV, not a button
    expect(() => dom.button('debugPanel')).toThrow(/expected/i)
  })

  it('optional helpers never throw and return null on missing/wrong type', () => {
    expect(dom.button.optional('nope')).toBeNull()
    expect(dom.button.optional('debugPanel')).toBeNull()

    // correct type should still return the element
    expect(dom.button.optional('saveBtn')).toBeInstanceOf(HTMLButtonElement)
  })

  it('byId(Type) works and matches types', () => {
    const el = byId('saveBtn', HTMLButtonElement)
    expect(el).toBeInstanceOf(HTMLButtonElement)

    expect(() => byId('saveBtn', HTMLInputElement)).toThrow()
  })

  it('byId.optional(Type) returns null instead of throwing', () => {
    expect(byId.optional('nope', HTMLDivElement)).toBeNull()
    expect(byId.optional('saveBtn', HTMLInputElement)).toBeNull()
    expect(byId.optional('debugPanel', HTMLDivElement)).toBeInstanceOf(HTMLDivElement)
  })

  it('tag(id, name) validates tagName', () => {
    expect(tag('appMain', 'main')).toBeInstanceOf(HTMLElement)
    expect(() => tag('hero', 'main')).toThrow(/expected/i)
  })

  it('tag.optional(id, name) returns null instead of throwing', () => {
    expect(tag.optional('nope', 'main')).toBeNull()
    expect(tag.optional('hero', 'main')).toBeNull()
    expect(tag.optional('hero', 'section')).toBeInstanceOf(HTMLElement)
  })

  it('createDom(root, { mode: "null" }) makes default lookups return null', () => {
    const d = createDom(document, { mode: 'null' })

    expect(d.button('nope')).toBeNull()
    expect(d.button('debugPanel')).toBeNull()
    expect(d.button('saveBtn')).toBeInstanceOf(HTMLButtonElement)
  })

  it('createDom(root, { mode: "throw" }) is strict', () => {
    const d = createDom(document, { mode: 'throw' })
    expect(() => d.button('nope')).toThrow()
  })

  it('onError is called when lookup fails (missing)', () => {
    const onError = vi.fn()
    const d = createDom(document, { mode: 'null', onError })

    const el = d.button('missingBtn')
    expect(el).toBeNull()
    expect(onError).toHaveBeenCalledOnce()

    const [err, ctx] = onError.mock.calls[0]
    expect(err).toBeInstanceOf(Error)
    expect(ctx).toMatchObject({ id: 'missingBtn', reason: 'missing' })
  })

  it('onError is called when lookup fails (wrong-type)', () => {
    const onError = vi.fn()
    const d = createDom(document, { mode: 'null', onError })

    const el = d.button('debugPanel')
    expect(el).toBeNull()
    expect(onError).toHaveBeenCalledOnce()

    const [, ctx] = onError.mock.calls[0]
    expect(ctx).toMatchObject({ id: 'debugPanel', reason: 'wrong-type' })
  })

  it('warn: true triggers console.warn (without breaking behavior)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = createDom(document, { mode: 'null', warn: true })

    expect(d.button('missingBtn')).toBeNull()
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })

  it('supports ShadowRoot root via querySelector fallback', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `<button id="shadowBtn">Hi</button>`

    const d = createDom(shadow, { mode: 'throw' })
    const btn = d.button('shadowBtn')
    expect(btn).toBeInstanceOf(HTMLButtonElement)

    document.body.removeChild(host)
  })

  it('supports Element root via querySelector fallback', () => {
    const container = document.createElement('div')
    container.innerHTML = `<input id="scopedInput" />`
    document.body.appendChild(container)

    const d = createDom(container, { mode: 'throw' })
    const input = d.input('scopedInput')
    expect(input).toBeInstanceOf(HTMLInputElement)

    document.body.removeChild(container)
  })
})