# id-dom

[![npm](https://img.shields.io/npm/v/id-dom)](https://www.npmjs.com/package/id-dom)
[![downloads](https://img.shields.io/npm/dm/id-dom)](https://www.npmjs.com/package/id-dom)
[![bundle size](https://img.shields.io/bundlephobia/minzip/id-dom)](https://bundlephobia.com/package/id-dom)
[![license](https://img.shields.io/npm/l/id-dom)](https://github.com/iWhatty/id-dom/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/id-dom?style=social)](https://github.com/iWhatty/id-dom)

**Deterministic DOM element getters by ID — typed, tiny, modern.**

`id-dom` is a small utility for grabbing DOM references safely **by `id`**, with predictable behavior:

* **Typed getters** like `button('saveBtn')`, `input('nameInput')`, `svg('icon')`
* **Strict or optional** mode (`throw` vs `null`)
* **Short optional alias** via `.opt`
* **Scoped lookups** for `document`, `ShadowRoot`, `DocumentFragment`, or an `Element`
* **Centralized error handling** with `onError` and optional `warn`
* **Zero deps**

This is deliberately **not** a selector framework. It is a tiny, ID-first primitive for safe DOM wiring.

---

## Install

```bash
npm install id-dom
```

---

## Quick Start

Two import styles, same root, same behavior. Pick by preference:

```js
// Default-object style — every typed helper lives under one namespace.
import dom from 'id-dom'

const saveBtn = dom.button('saveBtn')
saveBtn.addEventListener('click', save)
```

```js
// Named-import style — added in 0.0.5. Makes the dependency surface
// explicit in the import declaration. Tree-shaken identically by modern
// bundlers (esbuild, vite, rollup, webpack 5) since the package ships
// `sideEffects: false`.
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

### Bundle-size note

The shared lookup machinery (validation, CSS-escape fallback, error policy, root resolution) is the bulk of the package — roughly 1.9 KB gzipped in a modern bundler. Importing 4 helpers vs 1 vs the full default object lands in the same ballpark. The named-import style is recommended for readability and explicit-surface clarity, not for size.

---

## Why ID-first?

Using `getElementById` is:

* fast
* unambiguous
* easy to reason about

And with typed getters, you immediately know whether you got a `HTMLButtonElement`, `HTMLInputElement`, `SVGSVGElement`, and so on.

When scoped roots do not support `getElementById`, `id-dom` falls back to `querySelector(#id)` and safely escapes edge-case IDs.

---

## API

### Default export: `dom`

The default export is a scoped instance using `document` (when available) with **strict** behavior:

* missing element → **throws**
* wrong type or wrong tag → **throws**
* invalid input → **throws**

```js
import dom from 'id-dom'

const name = dom.input('nameInput')
const submit = dom.button('submitBtn')
```

---

### `createDom(root, config?)`

Create a scoped instance that searches within a specific root:

* `document` → uses `getElementById`
* `ShadowRoot`, `DocumentFragment`, or `Element` → uses `querySelector(#id)` fallback

```js
import { createDom } from 'id-dom'

const d = createDom(document, { mode: 'null', warn: true })
const sidebar = d.div('sidebar')
```

#### Config

```ts
type DomMode = 'throw' | 'null'

{
  mode?: DomMode
  warn?: boolean
  onError?: (err: Error, ctx: any) => void
}
```

---

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

#### Behavior

* valid match → returns the element
* missing element → throws or returns `null`
* wrong type → throws or returns `null`
* invalid `id` → throws or returns `null`
* invalid `Type` → throws or returns `null`

---

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

#### Behavior

* valid tag match → returns the element
* missing element → throws or returns `null`
* wrong tag → throws or returns `null`
* invalid `id` → throws or returns `null`
* invalid `tagName` → throws or returns `null`

---

## Built-in Getters

### Typed getters

Available on `dom` and on any `createDom()` instance:

* `el(id)` → `HTMLElement`
* `input(id)` → `HTMLInputElement`
* `button(id)` → `HTMLButtonElement`
* `textarea(id)` → `HTMLTextAreaElement`
* `select(id)` → `HTMLSelectElement`
* `form(id)` → `HTMLFormElement`
* `div(id)` → `HTMLDivElement`
* `span(id)` → `HTMLSpanElement`
* `label(id)` → `HTMLLabelElement`
* `canvas(id)` → `HTMLCanvasElement`
* `template(id)` → `HTMLTemplateElement`
* `svg(id)` → `SVGSVGElement`
* `body(id)` → `HTMLBodyElement`

Each getter also has:

```js
dom.canvas.optional('game')
dom.canvas.opt('game')
```

### Common tag helpers

* `main(id)` → validates `<main>`
* `section(id)` → validates `<section>`
* `small(id)` → validates `<small>`

Each also supports `.optional` and `.opt`.

---

## Error Handling

### Throwing mode

```js
import dom from 'id-dom'

dom.button('missing') // throws
```

### Null-returning mode

```js
import { createDom } from 'id-dom'

const d = createDom(document, { mode: 'null' })
d.button('missing') // null
```

### Central reporting

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

## Scoped Roots

### Shadow DOM

```js
import { createDom } from 'id-dom'

const host = document.querySelector('#widget')
const shadow = host.attachShadow({ mode: 'open' })
shadow.innerHTML = `<button id="shadowBtn">Click</button>`

const d = createDom(shadow)
const btn = d.button('shadowBtn')
```

### Element root

```js
const container = document.querySelector('#settings-panel')
const d = createDom(container)
const input = d.input('emailInput')
```

### SVG in scoped roots

```js
const container = document.querySelector('#icons')
const d = createDom(container)
const icon = d.svg('logoMark')
```

---

## Notes

* `el(id)` is specifically for `HTMLElement`, not every possible DOM `Element`.
* `body(id)` looks up a `<body>` **by ID**. This library stays ID-first on purpose.
* `tag()` can validate non-HTML tags too, such as `svg`, when used against supported scoped roots.

---

## Browser Support

Modern browsers supporting:

* `getElementById`
* `querySelector`

`CSS.escape` is used when available. A safe internal fallback is included for environments such as some jsdom builds where it may be missing.

---

## License

See `LICENSE`.
