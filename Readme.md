# dom-id

**Deterministic DOM element getters by ID (typed, tiny, modern).**

`dom-id` is a small utility for grabbing DOM references safely **by `id`**, with predictable behavior:

* ✅ **Typed getters** (`button('saveBtn')`, `input('name')`, etc.)
* ✅ **Strict or optional** mode (`throw` vs `null`)
* ✅ **Short optional alias** (`.opt`)
* ✅ **Scopable** to a root (`document`, `ShadowRoot`, or an `Element`)
* ✅ **Centralized error handling** (`onError`, optional `warn`)
* ✅ **Zero deps**

This is deliberately **not** a selector framework — it’s a tiny “ID-first” primitive for clean, safe DOM wiring.

---

## Install

```bash
npm install dom-id
```

---

## Quick Start

```js
import dom from 'dom-id'

const saveBtn = dom.button('saveBtn') // throws if missing or wrong type
saveBtn.addEventListener('click', save)
```

Optional access (never throws for missing/wrong-type):

```js
const debug = dom.div.optional('debugPanel')
debug?.append('hello')

// short alias
const maybeCanvas = dom.canvas.opt('game')
```

---

## Why ID-first?

Using `getElementById` is:

* fast
* unambiguous
* easy to reason about

…and with typed getters, you immediately know whether you have a `HTMLButtonElement`, `HTMLInputElement`, etc.

---

## API

### Default export: `dom`

The default export is a scoped instance using `document` (when available) with **strict** behavior:

* missing element → **throws**
* wrong type/tag → **throws**

```js
import dom from 'dom-id'

const name = dom.input('nameInput')
const submit = dom.button('submitBtn')
```

---

### `createDom(root, config?)`

Create a scoped instance that searches within a root:

* `document` (uses `getElementById`)
* `ShadowRoot` / `Element` (uses `querySelector(#id)` fallback)

```js
import { createDom } from 'dom-id'

const d = createDom(document, { mode: 'null', warn: true })

const sidebar = d.div('sidebar') // null if missing
```

#### Config

```ts
type DomMode = 'throw' | 'null'

{
  mode?: DomMode                 // default: 'throw'
  warn?: boolean                 // default: false
  onError?: (err: Error, ctx: any) => void
}
```

---

### `byId(id, Type, config?)`

Generic typed lookup:

```js
import { byId } from 'dom-id'

const btn = byId('saveBtn', HTMLButtonElement)
```

Optional variants (never throw for missing/wrong-type):

```js
const maybeBtn = byId.optional('saveBtn', HTMLButtonElement)
const maybeBtn2 = byId.opt('saveBtn', HTMLButtonElement)
```

---

### `tag(id, tagName, config?)`

Tag-based validation for semantic elements:

```js
import { tag } from 'dom-id'

const main = tag('appMain', 'main')
```

Optional variants:

```js
const maybeMain = tag.optional('appMain', 'main')
const maybeMain2 = tag.opt('appMain', 'main')
```

---

## Built-in Getters

### Typed getters

From `dom` (and any `createDom()` instance):

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

Each also has:

```js
dom.canvas.optional('game')
dom.canvas.opt('game')
```

### Common semantic tags

* `main(id)` → `<main>`
* `section(id)` → `<section>`
* `small(id)` → `<small>`

(Also with `.optional` and `.opt`.)

---

## Error Handling

### Throwing (default)

```js
import dom from 'dom-id'

dom.button('missing') // throws
```

### Null-returning mode

```js
import { createDom } from 'dom-id'

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

Enable console warnings:

```js
createDom(document, { mode: 'null', warn: true })
```

---

## Shadow DOM / Scoped Roots

```js
import { createDom } from 'dom-id'

const host = document.querySelector('#widget')
const shadow = host.attachShadow({ mode: 'open' })
shadow.innerHTML = `<button id="shadowBtn">Click</button>`

const d = createDom(shadow)
const btn = d.button('shadowBtn')
```

---

## Browser Support

Modern browsers supporting:

* `getElementById`
* `querySelector`
* `CSS.escape`

---

## License

See `LICENSE`.
