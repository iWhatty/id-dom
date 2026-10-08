// id-dom.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import dom, { byId, tag, createDom, main, button, IdDomError } from './id-dom.js'

describe('id-dom', () => {
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

  // Since 0.2.0 .opt / .optional relax only absence: a wrong type still throws.
  it('optional helpers return null when missing and throw on a wrong type', () => {
    expect(dom.button.optional('nope')).toBeNull()
    expect(dom.button.opt('nope')).toBeNull()
    expect(() => dom.button.optional('debugPanel')).toThrow(
      'id-dom: expected HTMLButtonElement for #debugPanel, got HTMLDivElement')
    expect(() => button.opt('debugPanel')).toThrow(IdDomError)

    // correct type should still return the element
    expect(dom.button.optional('saveBtn')).toBeInstanceOf(HTMLButtonElement)
  })

  it('byId(Type) works and matches types', () => {
    const el = byId('saveBtn', HTMLButtonElement)
    expect(el).toBeInstanceOf(HTMLButtonElement)

    expect(() => byId('saveBtn', HTMLInputElement)).toThrow()
  })

  it('byId.optional(Type) returns null when missing and throws on a wrong type', () => {
    expect(byId.optional('nope', HTMLDivElement)).toBeNull()
    expect(() => byId.optional('saveBtn', HTMLInputElement)).toThrow(/expected HTMLInputElement/)
    expect(byId.optional('debugPanel', HTMLDivElement)).toBeInstanceOf(HTMLDivElement)
  })

  it('tag(id, name) validates tagName', () => {
    expect(tag('appMain', 'main')).toBeInstanceOf(HTMLElement)
    expect(() => tag('hero', 'main')).toThrow(/expected/i)
  })

  it('tag.optional(id, name) returns null when missing and throws on a wrong tag', () => {
    expect(tag.optional('nope', 'main')).toBeNull()
    expect(() => tag.optional('hero', 'main')).toThrow('id-dom: expected <main> for #hero, got <section>')
    expect(() => dom.main.opt('hero')).toThrow(IdDomError)
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
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => { })
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

  it('supports SVG lookup inside scoped roots', () => {
    const container = document.createElement('div')
    container.innerHTML = `<svg id="icon"></svg>`
    document.body.appendChild(container)

    const d = createDom(container, { mode: 'throw' })
    const svg = d.svg('icon')

    expect(svg).toBeInstanceOf(SVGSVGElement)

    document.body.removeChild(container)
  })

  it('supports HTMLBodyElement helper', () => {
    document.body.id = 'pageBody'
    const body = byId('pageBody', HTMLBodyElement)
    expect(body).toBeInstanceOf(HTMLBodyElement)
  })

  it('supports body helper', () => {
    document.body.id = 'pageBody'
    const d = createDom(document, { mode: 'throw' })
    expect(d.body('pageBody')).toBeInstanceOf(HTMLBodyElement)
  })

  it('byId returns null/throws predictably for invalid id', () => {
    expect(() => byId.optional('', HTMLDivElement)).toThrow(/invalid id/i)
    expect(byId('', HTMLDivElement, { mode: 'null' })).toBeNull()
    expect(() => byId('', HTMLDivElement)).toThrow(/invalid id/i)
  })

  it('byId returns null/throws predictably for invalid Type', () => {
    expect(() => byId.optional('x', null)).toThrow(/invalid type/i)
    expect(byId('x', null, { mode: 'null' })).toBeNull()
    expect(() => byId('x', null)).toThrow(/invalid type/i)
  })

  it('tag returns null/throws predictably for invalid id', () => {
    expect(() => tag.optional('', 'main')).toThrow(/invalid id/i)
    expect(tag('', 'main', { mode: 'null' })).toBeNull()
    expect(() => tag('', 'main')).toThrow(/invalid id/i)
  })

  it('tag returns null/throws predictably for invalid tagName', () => {
    expect(() => tag.optional('appMain', '')).toThrow(/invalid tag/i)
    expect(tag('appMain', '', { mode: 'null' })).toBeNull()
    expect(() => tag('appMain', '')).toThrow(/invalid tag/i)
  })


  it('a function that cannot be a Type (no prototype) is an invalid Type, not a TypeError', () => {
    const arrow = () => {}
    const onError = vi.fn()

    expect(() => byId.optional('saveBtn', arrow)).toThrow(/invalid type/i)
    expect(() => byId('saveBtn', arrow)).toThrow(/invalid type/i)
    expect(byId('saveBtn', arrow, { mode: 'null', onError })).toBeNull()
    expect(onError.mock.calls[0][1]).toMatchObject({ id: 'saveBtn', reason: 'invalid-type' })
  })

  it('an Element root from another window (iframe, second jsdom) finds its elements', () => {
    const other = new JSDOM('<!doctype html><body><main id="otherMain"></main></body>')
    const root = other.window.document.body

    expect(tag('otherMain', 'main', { root })).toBe(root.firstElementChild)
    expect(tag.optional('nope', 'main', { root })).toBeNull()
  })

  it.each([
    ['-'], ['--'], ['-1'], ['1a'], ['a.b'], ['a:b'], ['a#b'], ['a b'], ['été'], ['_'],
  ])('Element roots find odd but valid ids without CSS.escape: %j', (id) => {
    expect(typeof CSS).toBe('undefined') // the internal fallback is in use
    const container = document.createElement('div')
    const target = document.createElement('div')
    target.setAttribute('id', id)
    container.append(document.createElement('span'), target)

    expect(createDom(container).div(id)).toBe(target)
  })

  it('the CSS.escape fallback escapes a lone "-" as CSS.escape does', () => {
    const selectors = []
    const root = { querySelector: (sel) => { selectors.push(sel); return null } }

    expect(createDom(root, { mode: 'null' }).div('-')).toBeNull()
    expect(selectors).toEqual(['#\\-'])
  })

  it('tag can validate non-HTMLElement elements if tag matches', () => {
    const container = document.createElement('div')
    container.innerHTML = `<svg id="icon"></svg>`
    document.body.appendChild(container)

    expect(tag('icon', 'svg', { root: container, mode: 'throw' })).toBeInstanceOf(SVGSVGElement)

    document.body.removeChild(container)
  })

  // A leading '#' is a selector habit. The id is still looked up as passed
  // (an element may really have id="#x"), but the error names it as passed
  // and says why it is probably missing.
  it('a missing id with a leading "#" is named as passed, with a hint', () => {
    expect(() => byId('#saveBtn', HTMLButtonElement)).toThrow(
      "id-dom: missing HTMLButtonElement element id '#saveBtn' (ids are passed without '#')")
    expect(() => dom.button('#saveBtn')).toThrow(
      "id-dom: missing HTMLButtonElement element id '#saveBtn' (ids are passed without '#')")
    expect(() => tag('#appMain', 'main')).toThrow(
      "id-dom: missing <main> element id '#appMain' (ids are passed without '#')")

    const container = document.createElement('div')
    container.innerHTML = '<input id="scoped">'
    expect(() => createDom(container).input('#scoped')).toThrow(
      "id-dom: missing HTMLInputElement element id '#scoped' (ids are passed without '#')")
  })

  it('a missing id with a leading "#" still follows the mode', () => {
    const onError = vi.fn()

    expect(byId.opt('#saveBtn', HTMLButtonElement)).toBeNull()
    expect(createDom(document, { mode: 'null', onError }).button('#saveBtn')).toBeNull()
    expect(onError.mock.calls[0][0].message).toMatch(/ids are passed without '#'/)
    expect(onError.mock.calls[0][1]).toMatchObject({ id: '#saveBtn', reason: 'missing' })
  })

  it('an element whose id really starts with "#" is found, and named as passed', () => {
    document.body.innerHTML = '<div id="#odd"></div>'

    expect(dom.div('#odd').id).toBe('#odd')
    expect(() => dom.button('#odd')).toThrow(
      "id-dom: expected HTMLButtonElement for id '#odd', got HTMLDivElement")
  })

  it('ids without "#" keep their messages', () => {
    expect(() => dom.button('nope')).toThrow('id-dom: missing HTMLButtonElement element #nope')
    expect(() => dom.button('debugPanel')).toThrow(
      'id-dom: expected HTMLButtonElement for #debugPanel, got HTMLDivElement')
  })

  // No element's tag name contains whitespace (createElement rejects it), so
  // a tagName with whitespace can never match: it is an invalid tagName,
  // reported before the lookup, as an empty one is.
  it.each([[' main'], ['main '], ['\tmain\n'], ['ma in']])(
    'tag() reports a tagName with whitespace as invalid: %j', (name) => {
      const onError = vi.fn()

      expect(() => tag('appMain', name)).toThrow(`id-dom: invalid tagName '${name}' for #appMain`)
      expect(() => tag('nope', name)).toThrow(/invalid tagName/)
      expect(tag('appMain', name, { mode: 'null', onError })).toBeNull()
      expect(onError.mock.calls[0][1]).toMatchObject({ id: 'appMain', reason: 'invalid-tag', tagName: name })
      expect(createDom(document, { mode: 'null' }).tag.opt('appMain', name)).toBeNull()
    })

  it('tag() still matches a valid tagName in any case', () => {
    expect(tag('appMain', 'MAIN').id).toBe('appMain')
    expect(tag('appMain', 'Main').id).toBe('appMain')
  })

  // Documents the contract the README states: main/section/small check the
  // tag name only, like tag(), so an element of another namespace with that
  // name (here SVG) matches although it is not an HTMLElement.
  it('main() checks the tag name only, not the namespace', () => {
    document.body.innerHTML = '<svg><main id="svgMain"></main></svg><main id="htmlMain"></main>'

    expect(main('htmlMain')).toBeInstanceOf(HTMLElement)
    const foreign = main('svgMain')
    expect(foreign.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(foreign).not.toBeInstanceOf(HTMLElement)
  })

  // Every failure is an IdDomError whose `reason` and `id` say what went wrong,
  // so callers can tell a missing element from a wrong one without parsing
  // the message.
  it('throws IdDomError with reason and id for each kind of failure', () => {
    const cases = [
      [() => dom.button('nope'), 'missing', 'nope'],
      [() => dom.button('debugPanel'), 'wrong-type', 'debugPanel'],
      [() => byId('saveBtn', HTMLInputElement), 'wrong-type', 'saveBtn'],
      [() => tag('hero', 'main'), 'wrong-tag', 'hero'],
      [() => dom.main('hero'), 'wrong-tag', 'hero'],
      [() => byId('', HTMLDivElement), 'invalid-id', ''],
      [() => byId('x', null), 'invalid-type', 'x'],
      [() => tag('x', ''), 'invalid-tag', 'x'],
    ]
    for (const [call, reason, id] of cases) {
      let caught
      try { call() } catch (err) { caught = err }
      expect(caught, reason).toBeInstanceOf(IdDomError)
      expect(caught).toBeInstanceOf(Error)
      expect(caught).toMatchObject({ name: 'IdDomError', reason, id })
    }
  })

  it('onError receives the same IdDomError, with err.reason matching ctx.reason', () => {
    const onError = vi.fn()
    const d = createDom(document, { mode: 'null', onError })
    d.button('nope')
    d.button('debugPanel')

    for (const [err, ctx] of onError.mock.calls) {
      expect(err).toBeInstanceOf(IdDomError)
      expect(err.reason).toBe(ctx.reason)
      expect(err.id).toBe(ctx.id)
    }
    expect(onError.mock.calls.map(([err]) => err.reason)).toEqual(['missing', 'wrong-type'])
  })

  // .opt / .optional: absence is acceptable, a wrong element is not. Both
  // are reported to onError / warn like the hard getter's failures.
  it('.opt: missing returns null, wrong type or tag throws, both reported', () => {
    const onError = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = createDom(document, { onError, warn: true })

    expect(d.button.opt('nope')).toBeNull()
    expect(() => d.button.opt('debugPanel')).toThrow(IdDomError)
    expect(() => d.main.opt('hero')).toThrow(IdDomError)
    expect(() => d.tag.opt('hero', 'main')).toThrow(IdDomError)
    expect(() => d.byId.opt('saveBtn', HTMLInputElement)).toThrow(IdDomError)
    expect(d.button.opt('saveBtn')).toBeInstanceOf(HTMLButtonElement)
    expect(onError.mock.calls.map(([err]) => err.reason))
      .toEqual(['missing', 'wrong-type', 'wrong-tag', 'wrong-tag', 'wrong-type'])
    expect(warn).toHaveBeenCalledTimes(5)
    warn.mockRestore()
  })

  it('.opt in a "null" scope still returns null for every failure', () => {
    const d = createDom(document, { mode: 'null' })
    expect(d.button.opt('nope')).toBeNull()
    expect(d.button.opt('debugPanel')).toBeNull()
    expect(d.main.opt('hero')).toBeNull()
    expect(d.byId.opt('', HTMLDivElement)).toBeNull()
  })

  // mode must be 'throw', 'null' or unset; a typo throws instead of silently
  // picking the 'null' policy.
  it.each([['nul'], ['THROW'], [''], [0], [false], [true]])('an invalid mode throws: %j', (mode) => {
    const check = (fn) => {
      let caught
      try { fn() } catch (err) { caught = err }
      expect(caught).toBeInstanceOf(IdDomError)
      expect(caught.reason).toBe('invalid-mode')
      expect(caught.message).toMatch(/^id-dom: invalid mode '.*' \(expected 'throw' or 'null'\)$/)
      return caught
    }
    expect(check(() => createDom(document, { mode })).id).toBe('')
    expect(check(() => byId('saveBtn', HTMLButtonElement, { mode })).id).toBe('saveBtn')
    check(() => byId.opt('saveBtn', HTMLButtonElement, { mode }))
    check(() => tag('appMain', 'main', { mode }))
    check(() => tag.optional('nope', 'main', { mode }))
  })

  it('an invalid mode is not passed to onError', () => {
    const onError = vi.fn()
    expect(() => byId('saveBtn', HTMLButtonElement, { mode: 'nul', onError })).toThrow(IdDomError)
    expect(onError).not.toHaveBeenCalled()
  })

  it('valid modes are unchanged: throw, null, unset, undefined', () => {
    for (const config of [undefined, {}, { mode: undefined }, { mode: 'throw' }]) {
      expect(byId('saveBtn', HTMLButtonElement, config).id).toBe('saveBtn')
      expect(() => byId('nope', HTMLButtonElement, config)).toThrow(/missing/)
      expect(() => createDom(document, config).div('saveBtn')).toThrow(/expected HTMLDivElement/)
    }
    expect(byId('nope', HTMLButtonElement, { mode: 'null' })).toBeNull()
    expect(byId('saveBtn', HTMLInputElement, { mode: 'null' })).toBeNull()
    expect(createDom(document, { mode: 'null' }).div('saveBtn')).toBeNull()
  })

  // A typed helper names the type it declares, not the name of whatever
  // constructor the global currently holds (a test fake, a subclass, a
  // minified class).
  describe('typed helpers name their declared type', () => {
    let original
    beforeEach(() => { original = globalThis.HTMLButtonElement })
    afterEach(() => { globalThis.HTMLButtonElement = original })

    it('with a fake global constructor', () => {
      globalThis.HTMLButtonElement = class FakeButton {}

      expect(() => dom.button('nope')).toThrow('id-dom: missing HTMLButtonElement element #nope')
      expect(() => button('nope')).toThrow('id-dom: missing HTMLButtonElement element #nope')
      expect(() => dom.button('debugPanel')).toThrow(
        'id-dom: expected HTMLButtonElement for #debugPanel, got HTMLDivElement')
    })

    it('with a subclass as the global constructor', () => {
      globalThis.HTMLButtonElement = class SubButton extends original {}

      expect(() => createDom(document).button('nope')).toThrow(
        'id-dom: missing HTMLButtonElement element #nope')
      expect(() => button('debugPanel')).toThrow(/^id-dom: expected HTMLButtonElement for #debugPanel/)
    })
  })

  it('byId names the Type it was given, and copes with an anonymous one', () => {
    class MyWidget extends HTMLElement {}
    expect(() => byId('nope', MyWidget)).toThrow('id-dom: missing MyWidget element #nope')

    const Anonymous = (() => class {})()
    expect(Anonymous.name).toBe('')
    expect(() => byId('nope', Anonymous)).toThrow('id-dom: missing element #nope')
    expect(() => byId('saveBtn', Anonymous)).toThrow(
      'id-dom: expected the given Type for #saveBtn, got HTMLButtonElement')
  })

})