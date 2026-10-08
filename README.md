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

Recommended for app code: a namespace import. It reads like one object (`dom.button(...)`), never clashes with your local variable names, and a bundler keeps only the helpers you call (see [Choosing an import style](#choosing-an-import-style)):

```js
import * as dom from 'id-dom'

// Hard: the element must exist and be a <button>. Otherwise this throws,
// so `saveBtn` is never null.
const saveBtn = dom.button('saveBtn')
saveBtn.addEventListener('click', save)

// Soft: absence is fine here. Returns the element, or null when no element
// has the id. Still throws if #debugPanel exists but is not a <div>.
const debug = dom.div.opt('debugPanel')
debug?.append('hello')
```

Use the hard getter when the page is broken without the element, and `.opt` (alias `.optional`) only where the element is genuinely optional. That replaces `document.getElementById(...)` plus an ad-hoc null check, or a `!` / `as HTMLButtonElement` cast, with a call that states the intent and checks the type.

Two other import styles give the same root and behavior:

```js
// Default-object style. Every typed helper lives under one object, and
// the bundle carries all of them.
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

Optional access returns `null` for a missing element, and still throws for an element of the wrong type (see [What `.opt` returns](#what-opt-returns)):

```js
const debug = dom.div.optional('debugPanel')   // default-object style
debug?.append('hello')

import { canvas } from 'id-dom'
const maybeCanvas = canvas.opt('game')          // named style
```

Ids are passed without `#`: `button('saveBtn')`, not `button('#saveBtn')`.

### Getters at a glance

Each is available as a named export, on `import * as dom`, on the default `dom` object and on every `createDom()` scope.

| Getter | Returns (hard call) | `.opt(id)` / `.optional(id)` | Checks |
| --- | --- | --- | --- |
| `el(id)` | `HTMLElement` | `HTMLElement \| null` | `instanceof HTMLElement` |
| `input(id)` | `HTMLInputElement` | `HTMLInputElement \| null` | `instanceof HTMLInputElement` |
| `button(id)` | `HTMLButtonElement` | `HTMLButtonElement \| null` | `instanceof HTMLButtonElement` |
| `textarea(id)` | `HTMLTextAreaElement` | `HTMLTextAreaElement \| null` | `instanceof HTMLTextAreaElement` |
| `select(id)` | `HTMLSelectElement` | `HTMLSelectElement \| null` | `instanceof HTMLSelectElement` |
| `form(id)` | `HTMLFormElement` | `HTMLFormElement \| null` | `instanceof HTMLFormElement` |
| `div(id)` | `HTMLDivElement` | `HTMLDivElement \| null` | `instanceof HTMLDivElement` |
| `span(id)` | `HTMLSpanElement` | `HTMLSpanElement \| null` | `instanceof HTMLSpanElement` |
| `label(id)` | `HTMLLabelElement` | `HTMLLabelElement \| null` | `instanceof HTMLLabelElement` |
| `canvas(id)` | `HTMLCanvasElement` | `HTMLCanvasElement \| null` | `instanceof HTMLCanvasElement` |
| `template(id)` | `HTMLTemplateElement` | `HTMLTemplateElement \| null` | `instanceof HTMLTemplateElement` |
| `svg(id)` | `SVGSVGElement` | `SVGSVGElement \| null` | `instanceof SVGSVGElement` |
| `body(id)` | `HTMLBodyElement` | `HTMLBodyElement \| null` | `instanceof HTMLBodyElement` |
| `main(id)`, `section(id)`, `small(id)` | `HTMLElement` | `HTMLElement \| null` | tag name (see [Built-in getters](#built-in-getters)) |
| `byId(id, Type)` | `T`, e.g. `byId('dlg', HTMLDialogElement)` | `T \| null` | `instanceof Type` |
| `tag(id, tagName)` | `Element` | `Element \| null` | tag name, case-insensitive |

In a `createDom(root, { mode: 'null' })` scope the hard call returns `T | null` too.

### Choosing an import style

The helper names (`button`, `input`, `select`, `form`, `label`, `div`, `el`, ...) are also the natural names for the elements they return. A named import and a local variable of the same name cannot meet in one scope:

```js
import { button } from 'id-dom'

function wire() {
  const button = button('saveBtn') // error: the local `button` shadows the import
}
```

In a long import list, `button` also reads like data rather than a lookup. Four ways out:

**1. A namespace import, for app code (recommended).** One import, no name to clash with, every call reads as a lookup, and the bundle is the same as named imports of just the helpers you call:

```js
import * as dom from 'id-dom'

function wireToolbar() {
  const button = dom.button('saveBtn')
  const input = dom.input.opt('title')
  button.addEventListener('click', () => save(input?.value))
}
```

`import * as dom` is an ES module namespace, not an object built at runtime, so a bundler (esbuild, Rollup, webpack) resolves `dom.button` statically and drops every helper you do not use. Two cautions keep that true: use the namespace only as `dom.helper(...)` (passing `dom` itself around, `Object.keys(dom)` or `dom[name]` makes a bundler keep everything), and do not confuse it with the default import below, which looks the same at the call site.

**2. The default object** (`import dom from 'id-dom'`). Same call sites, but it is one object holding every helper, so the bundle carries all of them, `byId`, `tag` and `createDom`. Prefer the namespace import unless you need a real object (to pass around or iterate).

**3. Aliased named imports**, to keep the import list explicit. An alias changes nothing in the bundle:

```js
import { button as buttonEl, input as inputEl } from 'id-dom'

const button = buttonEl('saveBtn')
const input = inputEl.opt('title')
```

**4. `byId` with the type**, for a one-off: `byId('saveBtn', HTMLButtonElement)` is the same check as `button('saveBtn')`.

Consumer bundle of `dist/index.js` with esbuild 0.28.2 (bundle, minify, tree shaking), id-dom 0.2.0, bytes. `test/tree-shake.test.js` checks that the namespace import bundles the same code as the matching named imports.

| Import | Minified | gzip -9 |
| --- | ---: | ---: |
| `{ byId }` | 3,114 | 1,429 |
| `{ button }`, or `{ button as buttonEl }` | 3,608 | 1,671 |
| `* as dom`, calling `dom.el` and `dom.button.opt` | 3,642 | 1,685 |
| `{ el, button }`, the same two calls | 3,642 | 1,685 |
| `{ button, div, el, form, input, select, byId }` | 3,830 | 1,743 |
| `import dom` (default object), the same two calls | 4,914 | 2,097 |

So for the same code the default object costs about 0.4 KB gzip more than the namespace import. Whichever style you use, the namespace and named imports cost only for the helpers you call.

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
  onError?: (err: IdDomError, ctx: any) => void
  root?: any // byId() and tag() only; createDom() takes the root as its first argument
}
```

`ctx` is `{ id, root, reason, ... }`, where `reason` is one of `'invalid-id'`, `'invalid-type'`, `'invalid-tag'`, `'missing'`, `'wrong-type'`, or `'wrong-tag'`, the same as `err.reason` (see [Error handling](#error-handling)).

`mode` accepts exactly `'throw'` (the default; also used when `mode` is `undefined` or `null`) and `'null'`. Since 0.2.0 any other value throws an `IdDomError` with reason `'invalid-mode'`: `createDom()` throws when it is called, `byId()` / `tag()` when they are called. It is thrown directly, not passed to `onError`. Before 0.2.0 a typo such as `mode: 'nul'` silently behaved as `'null'`.

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
- missing element → throws or returns `null` (`.opt` returns `null`)
- wrong type → throws or returns `null` (`.opt` throws in a `'throw'` scope)
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
- missing element → throws or returns `null` (`.opt` returns `null`)
- wrong tag → throws or returns `null` (`.opt` throws in a `'throw'` scope)
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
import * as dom from 'id-dom'

dom.button('missing') // throws IdDomError: id-dom: missing HTMLButtonElement element #missing
```

Every failure is an `IdDomError` (exported, since 0.2.0, a subclass of `Error`) with:

- `reason`: `'missing'`, `'wrong-type'` (typed getters, `byId`), `'wrong-tag'` (`tag`, `main`, `section`, `small`), `'invalid-id'`, `'invalid-type'`, `'invalid-tag'`, `'invalid-mode'` (thrown directly, see [`createDom`](#createdomroot-config)), or `'no-dom'` (a typed getter called without a DOM in a `'throw'` scope; thrown directly, not passed to `onError`; see [Server-side rendering](#server-side-rendering))
- `id`: the id as passed
- `name`: `'IdDomError'`

Match on `reason`, not on the message text:

```js
import { IdDomError } from 'id-dom'

try {
  dom.button('saveBtn')
} catch (err) {
  if (err instanceof IdDomError && err.reason === 'missing') { /* ... */ }
  else throw err
}
```

Messages have two main shapes, the same for every getter, always with the id:

- `id-dom: missing HTMLButtonElement element #saveBtn` (`tag()` and the tag helpers say `<main>`)
- `id-dom: expected HTMLButtonElement for #saveBtn, got HTMLDivElement`

A typed getter names the type it declares (`HTMLButtonElement` for `button`), even if the global constructor is a subclass, a test fake or a minified class (since 0.2.0; before, the constructor's own `name` was printed). `byId(id, Type)` names `Type.name`, so a class whose name your minifier mangles shows the mangled name; a `Type` without a name gives `missing element #x` and `expected the given Type for #x`. The "got" part is the found element's constructor name.

#### What `.opt` returns

`.opt` / `.optional` mean "this element may be absent". Since 0.2.0 they relax only that: an element that exists with the wrong type or tag is a bug, and they throw for it like the hard getter.

| Situation (`reason`) | Hard call, `'throw'` scope (default) | `.opt`, `'throw'` scope (default) | Any call, `'null'` scope |
| --- | --- | --- | --- |
| element found, right type | element | element | element |
| no element with the id (`missing`) | throws | **`null`** | `null` |
| element of the wrong type (`wrong-type`) | throws | **throws** (was `null` before 0.2.0) | `null` |
| element with the wrong tag (`wrong-tag`) | throws | **throws** (was `null` before 0.2.0) | `null` |
| invalid id, `Type` or `tagName` (`invalid-id`, `invalid-type`, `invalid-tag`) | throws | **throws** (was `null` before 0.2.0) | `null` |
| typed getter without a DOM (`no-dom`) | throws | `null` | `null` |
| invalid `mode` (`invalid-mode`) | throws | throws | n/a (the scope cannot be created) |

Every failure but `no-dom` and `invalid-mode` is passed to `onError` and, with `warn: true`, logged, before the call throws or returns `null`, in every mode and for `.opt` too. So a `.opt` miss still reaches `onError` with reason `'missing'`.

```js
const d = createDom(document, { onError: (err) => report(err) })
d.button.opt('nope')       // null; onError sees reason 'missing'
d.button.opt('debugPanel') // throws IdDomError 'wrong-type' if #debugPanel is a <div>
```

A `'null'` scope (`createDom(root, { mode: 'null' })`) is the opt-in policy for "never throw": every call in it, `.opt` included, returns `null` for every failure, with `onError` to tell them apart.

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

Since 0.0.8 every helper and the default `dom` object are built in calls marked `/* @__PURE__ */` (kept in `id-dom/min` too), so a bundler drops what you do not import. With esbuild (bundle, minify, gzip -9), 0.2.0: `{ byId }` is about 1.4 KB, `{ button }` about 1.7 KB, seven helpers about 1.7 KB, and the default `dom` object (every helper) about 2.1 KB; `import * as dom` costs the same as named imports of the helpers it calls; see the table under [Choosing an import style](#choosing-an-import-style). 0.0.7 shipped about 2.1 KB whatever you imported. The shared lookup machinery (validation, CSS-escape fallback, error policy, root resolution) is most of each figure.

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

Importing id-dom without a DOM (Node without jsdom, edge runtimes) is safe. Every helper stays callable: a typed getter (`input`, `button`, ...) throws a clear "requires a DOM" error (an `IdDomError` with reason `'no-dom'`, since 0.2.0) in a `'throw'` scope and returns `null` in a `'null'` scope, and `.optional` / `.opt` return `null` (no DOM means no element). This holds for the named exports, the default `dom` object, and `createDom()` scopes (the last two since 0.0.8).

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
