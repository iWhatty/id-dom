# id-dom

[![npm](https://img.shields.io/npm/v/id-dom)](https://www.npmjs.com/package/id-dom)
[![downloads](https://img.shields.io/npm/dm/id-dom)](https://www.npmjs.com/package/id-dom)
[![bundle size](https://img.shields.io/bundlephobia/minzip/id-dom)](https://bundlephobia.com/package/id-dom)
[![license](https://img.shields.io/npm/l/id-dom)](https://github.com/iWhatty/id-dom/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/id-dom?style=social)](https://github.com/iWhatty/id-dom)
[![types](https://img.shields.io/npm/types/id-dom)](https://www.npmjs.com/package/id-dom)

Deterministic DOM element getters by ID. Typed, tiny, modern. A small utility for grabbing DOM references safely by `id`, with predictable behavior.

## Features

- Typed getters like `button('saveBtn')`, `input('nameInput')`, `svg('icon')`
- Strict or optional mode (`throw` vs `null`)
- Short optional alias via `.opt`
- Scoped lookups for `document`, `ShadowRoot`, `DocumentFragment`, or an `Element`
- Centralized error handling with `onError` and optional `warn`
- Zero dependencies

This is deliberately **not** a selector framework. It is a tiny, ID-first primitive for safe DOM wiring.

---

## Install

```sh
pnpm add id-dom
```

---

## Quick start

Two import styles, same root, same behavior (see [Choosing an import style](#choosing-an-import-style)):

```js
// Default-object style. Every typed helper lives under one namespace.
import dom from 'id-dom'

const saveBtn = dom.button('saveBtn')
saveBtn.addEventListener('click', save)
```

```js
// Named-import style, added in 0.0.5. Makes the dependency surface explicit
// in the import declaration, and since 0.0.8 a bundler keeps only the
// helpers you import (see the bundle-size note).
import { button, input, div } from 'id-dom'

const saveBtn = button('saveBtn')
const email   = input('email')
const panel   = div('mainPanel')
```

Optional access never throws for missing or wrong-type elements:

```js
const debug = dom.div.optional('debugPanel')   // default-object style
debug?.append('hello')

import { canvas } from 'id-dom'
const maybeCanvas = canvas.opt('game')          // named style
```

Ids are passed without `#`: `button('saveBtn')`, not `button('#saveBtn')`.

### Choosing an import style

The helper names (`button`, `input`, `select`, `form`, `label`, `div`, `el`, ...) are also the natural names for the elements they return. A named import and a local variable of the same name cannot meet in one scope:

```js
import { button } from 'id-dom'

function wire() {
  const button = button('saveBtn') // error: the local `button` shadows the import
}
```

In a long import list, `button` also reads like data rather than a lookup. Three ways out:

**1. The default object, for app code with many lookups (recommended there).** One import, no name to clash with, and every call reads as a lookup:

```js
import dom from 'id-dom'

function wireToolbar() {
  const button = dom.button('saveBtn')
  const input = dom.input.opt('title')
  button.addEventListener('click', () => save(input?.value))
}
```

**2. Aliased named imports**, to keep the import list explicit. An alias changes nothing in the bundle:

```js
import { button as buttonEl, input as inputEl } from 'id-dom'

const button = buttonEl('saveBtn')
const input = inputEl.opt('title')
```

**3. `byId` with the type**, for a one-off: `byId('saveBtn', HTMLButtonElement)` is the same check as `button('saveBtn')`.

The trade-off is size. The default object carries every helper, `byId`, `tag` and `createDom`; named imports carry only what you import. Consumer bundle of `dist/index.js` with esbuild 0.28.2 (bundle, minify, tree shaking), id-dom 0.0.9, bytes:

| Import | Minified | gzip -9 |
| --- | ---: | ---: |
| `{ byId }` | 2,729 | 1,226 |
| `{ button }`, or `{ button as buttonEl }` | 3,198 | 1,456 |
| `{ button, div, el, form, input, select, byId }` | 3,447 | 1,557 |
| `import dom` (every helper) | 4,515 | 1,848 |

So the default object costs about 0.3 KB gzip more than seven named helpers, and 0.4 KB more than one. In an app that is usually worth the clearer code. A library, or a size-critical widget with a few lookups, is better served by named imports.

---

## API

### Default export: `dom`

The default export is a scoped instance using the global `document` (read at each lookup) with **strict** behavior:

- missing element → **throws**
- wrong type or wrong tag → **throws**
- invalid input → **throws**

```js
import dom from 'id-dom'

const name = dom.input('nameInput')
const submit = dom.button('submitBtn')
```

### `createDom(root, config?)`

Create a scoped instance that searches within a specific root:

- `document`, `ShadowRoot`, or `DocumentFragment` → uses `getElementById`
- `Element` → uses a `querySelector(#id)` fallback, which searches the element's descendants (not the element itself)
- no root (`undefined` or `null`) → the global `document` at the time of each lookup

```js
import { createDom } from 'id-dom'

const d = createDom(document, { mode: 'null', warn: true })
const sidebar = d.div('sidebar')
```

A `null` root means the whole document, so check a root that can be `null` before scoping to it. `host.shadowRoot` is `null` for a closed shadow root or a host without one, and `createDom(host.shadowRoot)` would then search the document, not the shadow tree. Keep the `ShadowRoot` that `attachShadow()` returns instead.

**Config:**

```ts
type DomMode = 'throw' | 'null'

{
  mode?: DomMode
  warn?: boolean
  onError?: (err: Error, ctx: any) => void
  root?: any // byId() and tag() only; createDom() takes the root as its first argument
}
```

`ctx` is `{ id, root, reason, ... }`, where `reason` is one of `'invalid-id'`, `'invalid-type'`, `'invalid-tag'`, `'missing'`, `'wrong-type'`, or `'wrong-tag'`.

### `byId(id, Type, config?)`

Generic typed lookup:

```js
import { byId } from 'id-dom'

const btn = byId('saveBtn', HTMLButtonElement)
```

Optional variants:

```js
const maybeBtn = byId.optional('saveBtn', HTMLButtonElement)
const maybeBtn2 = byId.opt('saveBtn', HTMLButtonElement)
```

Behavior:

- TypeScript: returns `T` in `'throw'` mode (the default), `T | null` with `mode: 'null'` and for `.optional` / `.opt`
- valid match → returns the element
- missing element → throws or returns `null`
- wrong type → throws or returns `null`
- invalid `id` → throws or returns `null`
- invalid `Type` → throws or returns `null`
- an id is used exactly as passed. A leading `#` is not stripped, since an element can have `id="#x"`; when no such element exists, the error names the id as passed and adds a hint (since 0.0.9): `id-dom: missing HTMLButtonElement element id '#saveBtn' (ids are passed without '#')`

### `tag(id, tagName, config?)`

Tag-based validation when constructor checks are not the right fit:

```js
import { tag } from 'id-dom'

const main = tag('appMain', 'main')
const icon = tag('icon', 'svg', { root: container })
```

Optional variants:

```js
const maybeMain = tag.optional('appMain', 'main')
const maybeMain2 = tag.opt('appMain', 'main')
```

Behavior:

- valid tag match (case-insensitive) → returns the element
- missing element → throws or returns `null`
- wrong tag → throws or returns `null`
- invalid `id` → throws or returns `null`
- invalid `tagName` (not a string, empty, or containing whitespace) → throws or returns `null`. No element's tag name contains whitespace, so `' main'` could never match; since 0.0.9 it is reported as `'invalid-tag'` before the lookup, instead of as `'missing'` or `'wrong-tag'`.

### Built-in getters

Typed getters available on `dom` and on any `createDom()` instance:

- `el(id)` → `HTMLElement`
- `input(id)` → `HTMLInputElement`
- `button(id)` → `HTMLButtonElement`
- `textarea(id)` → `HTMLTextAreaElement`
- `select(id)` → `HTMLSelectElement`
- `form(id)` → `HTMLFormElement`
- `div(id)` → `HTMLDivElement`
- `span(id)` → `HTMLSpanElement`
- `label(id)` → `HTMLLabelElement`
- `canvas(id)` → `HTMLCanvasElement`
- `template(id)` → `HTMLTemplateElement`
- `svg(id)` → `SVGSVGElement`
- `body(id)` → `HTMLBodyElement`

Each getter also has `.optional` and `.opt` variants:

```js
dom.canvas.optional('game')
dom.canvas.opt('game')
```

Common tag helpers:

- `main(id)` → validates `<main>`, typed `HTMLElement`
- `section(id)` → validates `<section>`, typed `HTMLElement`
- `small(id)` → validates `<small>`, typed `HTMLElement`

Each also supports `.optional` and `.opt`.

These elements have no interface of their own (in HTML they are plain `HTMLElement`), so these helpers check the tag name, case-insensitively, like `tag()`. They do not check the namespace. In an HTML document every `<main>`, `<section>` or `<small>` is an `HTMLElement`, so the type holds. An element of another namespace with the same name also matches and is returned typed `HTMLElement`, which it is not: a `<main>` or `<section>` inside `<svg>` (the HTML parser makes it an SVG element), one made with `document.createElementNS()`, or one in an XML document. Where markup like that is possible, use `tag(id, 'main')` (typed `Element`) or `el(id)` (checks `HTMLElement`, not the tag).

### Error handling

**Throwing mode:**

```js
import dom from 'id-dom'

dom.button('missing') // throws
```

**Null-returning mode:**

```js
import { createDom } from 'id-dom'

const d = createDom(document, { mode: 'null' })
d.button('missing') // null
```

**Central reporting:**

```js
const d = createDom(document, {
  mode: 'null',
  onError: (err, ctx) => {
    // sendToSentry({ err, ctx })
  },
})
```

Enable console warnings too:

```js
createDom(document, { mode: 'null', warn: true })
```

---

## Notes

### Why id-first?

Using `getElementById` is fast, unambiguous, and easy to reason about. With typed getters, you immediately know whether you got a `HTMLButtonElement`, `HTMLInputElement`, `SVGSVGElement`, and so on.

When a scoped root does not support `getElementById` (an `Element`), id-dom falls back to `querySelector(#id)` and safely escapes edge-case IDs.

### Bundle-size note

Since 0.0.8 every helper and the default `dom` object are built in calls marked `/* @__PURE__ */` (kept in `id-dom/min` too), so a bundler drops what you do not import. With esbuild (bundle, minify, gzip -9), 0.0.9: `{ byId }` is about 1.2 KB, `{ button }` about 1.5 KB, seven helpers about 1.6 KB, and the default `dom` object (every helper) about 1.8 KB; see the table under [Choosing an import style](#choosing-an-import-style). 0.0.7 shipped about 2.1 KB whatever you imported. The shared lookup machinery (validation, CSS-escape fallback, error policy, root resolution) is most of each figure.

### Scoped roots

**Shadow DOM:**

```js
import dom, { createDom } from 'id-dom'

const host = dom.el('widget')
const shadow = host.attachShadow({ mode: 'open' })
shadow.innerHTML = `<button id="shadowBtn">Click</button>`

const d = createDom(shadow)
const btn = d.button('shadowBtn')
```

**Element root:**

```js
const container = dom.el('settings-panel')
const d = createDom(container)
const input = d.input('emailInput')
```

**SVG in scoped roots:**

```js
const container = dom.el('icons')
const d = createDom(container)
const icon = d.svg('logoMark')
```

### Misc

- `el(id)` is specifically for `HTMLElement`, not every possible DOM `Element`.
- `body(id)` looks up a `<body>` **by ID**. This library stays ID-first on purpose.
- `tag()` can validate non-HTML tags too, such as `svg`, when used against supported scoped roots.
- Elements from another window (an iframe's document, a second jsdom) are found, but a typed getter checks `instanceof` against this window's constructors, so it reports them as the wrong type. Use `tag()` for them.

### Server-side rendering

Importing id-dom without a DOM (Node without jsdom, edge runtimes) is safe. Every helper stays callable: a typed getter (`input`, `button`, ...) throws a clear "requires a DOM" error in a `'throw'` scope and returns `null` in a `'null'` scope, and `.optional` / `.opt` return `null`. This holds for the named exports, the default `dom` object, and `createDom()` scopes (the last two since 0.0.8).

The DOM can be installed after import (a test setup, a late jsdom, hydration): since 0.0.8 id-dom reads the global `document` and the element constructors (`globalThis.HTMLButtonElement`, ...) on each lookup, so the same helpers start finding elements once they exist, and behave as above again if the DOM is removed. A root passed to `createDom(root)` or `{ root }` is always used as given.

### CommonJS

`require('id-dom')` loads `dist/index.cjs`, with matching types (`dist/types/id-dom.d.cts`, since 0.0.8). Named helpers are properties of the module; the default object is `.default`:

```js
const { button, createDom } = require('id-dom')
const dom = require('id-dom').default
```

`id-dom/min` is ES modules only. `id-dom/package.json` is exported too (since 0.0.9), for tools that read it.

### Browser support

Modern browsers supporting:

- `getElementById`
- `querySelector`

`CSS.escape` is used when available. A safe internal fallback is included for environments such as some jsdom builds where it may be missing.

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
