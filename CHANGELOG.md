# CHANGELOG — `id-dom`

> Initial cut seeded from `git log` by the host repo's `tools/seed-changelogs.mjs` script. Version groupings infer release boundaries from tags and commit subjects; rough cuts are expected — review and tighten as part of normal maintenance.

## 0.1.0 — unreleased (prepared 2026-10-08)

An exported error class so apps can tell a missing element from a wrong one, messages that name the expected type a typed getter declares, and README guidance that recommends `import * as dom from 'id-dom'`. Minor bump: a new export and a new `reason`. No call changes its result; see "Observable changes".

Runtime:

- **feat (runtime): `IdDomError`, with `reason` and `id`.**
  - Every lookup failure is now an `IdDomError` (a subclass of `Error`, exported from `id-dom`, `id-dom/min` and the CommonJS build) with `name: 'IdDomError'`, `reason` (`'missing'`, `'wrong-type'`, `'wrong-tag'`, `'invalid-id'`, `'invalid-type'`, `'invalid-tag'`, `'no-dom'`) and `id` (as passed). The same object is thrown in `'throw'` mode and passed to `onError` in every mode, where `err.reason === ctx.reason`.
  - Before, callers got a plain `Error` and had to parse the message (or use `onError`'s `ctx`) to tell a missing element from one of the wrong type.
  - The "requires a DOM" error of a typed getter without a DOM is an `IdDomError` with the new reason `'no-dom'`. It is still thrown directly (not passed to `onError`), as before.
- **fix (runtime): typed getters name the type they declare.**
  - Messages used the global constructor's `name`, so with a test fake (`globalThis.HTMLButtonElement = class FakeButton {}`), a subclass or a minified class, `button('save')` reported `missing FakeButton element #save`. Typed getters now always say `HTMLButtonElement`, `HTMLInputElement`, ...: `id-dom: missing HTMLButtonElement element #save`, `id-dom: expected HTMLButtonElement for #save, got HTMLDivElement`.
  - `byId(id, Type)` still names `Type.name`. A `Type` without a name no longer gives a double space: `id-dom: missing element #x`, `id-dom: expected the given Type for #x, got ...`.

Observable changes (none changes a result or a mode):

- Thrown and reported errors are `IdDomError` instances: `err.name` and `String(err)` say `IdDomError` instead of `Error`. `instanceof Error` and every message are unchanged, except the expected-type name in the fake/subclass/minified-constructor and nameless-`Type` cases above.

Types:

- `IdDomError` and the `IdDomReason` union are exported. `DomConfig['onError']` receives `IdDomError` instead of `Error`; a callback typed `(err: Error) => void` is still accepted.

Docs:

- **docs(README): `import * as dom from 'id-dom'` is the recommended app style.** It reads like the default object (`dom.button(...)`, `dom.button.opt(...)`), avoids the helper-name clash, and bundles like named imports: for `dom.el` plus `dom.button.opt`, 3,388 bytes minified against 4,659 for the default object (1,579 / 1,989 gzip). The quick start shows a hard getter and an `.opt` getter, a table lists every getter with its hard and `.opt` return types, and "Choosing an import style" puts the namespace import first and says what keeps it tree-shakeable.
- docs(README): `IdDomError`, its reasons and the two message shapes; what `.opt` returns (`null` for a wrong type and invalid input too, not only for a missing element, with `onError` to tell them apart); a `mode` other than `'throw'` behaves as `'null'`.

Size: consumer bundles, esbuild 0.28.2 (`bundle`, `minify`, tree shaking) of `dist/index.js`, bytes raw / gzip -9. The error class and its wiring cost about 100 bytes gzip; the gzip budgets in `test/tree-shake.test.js` went up by that much.

  | Import | 0.0.9 | 0.1.0 |
  | --- | --- | --- |
  | `{ byId }` | 2,726 / 1,223 | 2,868 / 1,330 |
  | `{ button }` | 3,195 / 1,453 | 3,354 / 1,567 |
  | `{ main }` | 2,920 / 1,269 | 3,024 / 1,352 |
  | `* as dom` or `{ el, button }`, calling `el` and `button.opt` | 3,229 / 1,467 | 3,388 / 1,579 |
  | `import dom` (default), the same two calls | 4,526 / 1,855 | 4,659 / 1,989 |

Tests:

- `src/id-dom.test.js`: `IdDomError` with `reason`, `id` and `name` for every reason a lookup can report; `onError` receives the same error with `err.reason === ctx.reason`; `.opt` returns `null` for missing and wrong-type alike while `onError` sees which; typed getters name `HTMLButtonElement` with a fake and with a subclass global constructor (both failed on 0.0.9); `byId` with a named and a nameless `Type`.
- `test/ssr.test.js`: the "requires a DOM" error is an `IdDomError` with reason `'no-dom'`, for the source and every build.
- `test/tree-shake.test.js`: `import * as dom` bundles exactly the code of the matching named imports, without other helpers, within the `button` budget.
- `test/types`: `IdDomError` / `IdDomReason` types, `onError`'s parameter type, and the new README examples.

## 0.0.9 — 2026-10-08

Clearer errors for two caller mistakes, a `./package.json` export, and README guidance for helper names that clash with local variable names. No API or type signature changes. One observable change: `tag()` reports a `tagName` with whitespace as `'invalid-tag'` (such a call never matched before either).

Runtime:

- **fix (runtime): an id with a leading `#` is named as passed, with a hint.**
  - `byId('#saveBtn', HTMLButtonElement)` reported `id-dom: missing HTMLButtonElement element #saveBtn`, which reads like the selector of the right id and hides the stray `#`.
  - The id is still looked up exactly as passed (an element can have `id="#x"`), so results, modes, `onError` and `ctx` are unchanged. Messages now quote such an id as passed (`id '#saveBtn'`), and a missing-element error adds a hint: `id-dom: missing HTMLButtonElement element id '#saveBtn' (ids are passed without '#')`.
  - Ids without a leading `#` keep their messages (`id-dom: missing HTMLButtonElement element #saveBtn`).
- **fix (runtime): `tag()` validates and compares the same `tagName`.**
  - Validation trimmed the name but the comparison did not, so `tag(id, ' main')` passed validation and could never match: it reported `'missing'`, or `'wrong-tag'` with `expected < main> ..., got <main>`.
  - A `tagName` must now be a non-empty string without whitespace. No element's tag name contains any (`createElement` rejects it). Anything else is reason `'invalid-tag'`, reported before the lookup and following the mode as before; the message quotes a string name: `id-dom: invalid tagName ' main' for #app`.
  - Rejecting rather than trimming: ids are used exactly as passed, so tag names are too, and no call that matched before changes its result. A call that always failed still fails, now with the reason that names the mistake; trimming would have silently repaired it. Matching stays case-insensitive.
- Consumer bundle sizes, esbuild 0.28.2 (`bundle`, `minify`, tree shaking) of `dist/index.js`, bytes raw / gzip -9, each consumer calling every helper it imports. `dist/index.min.js` is within 1 byte gzip. The new message text costs about 40 bytes gzip; the `main` budget in `test/tree-shake.test.js` went from 1,270 to 1,300.

  | Import | 0.0.8 | 0.0.9 |
  | --- | --- | --- |
  | `{ button }` (or `{ button as buttonEl }`) | 3,125 / 1,418 | 3,198 / 1,456 |
  | `{ byId }` | 2,656 / 1,183 | 2,729 / 1,226 |
  | `{ button, div, el, form, input, select, byId }` | 3,374 / 1,521 | 3,447 / 1,557 |
  | `import dom` (default) | 4,396 / 1,776 | 4,515 / 1,848 |

Types:

- **docs (types): `main`, `section` and `small` say what they check.** They stay typed `TypedHelper<HTMLElement>`. Their JSDoc (shown in editors) now says they check the tag name only, not the namespace. In an HTML document the type holds; an element of another namespace with the same name (a `<main>` inside `<svg>`, `createElementNS()`, an XML document) also matches and is not an `HTMLElement`. Narrowing them to `Element` would break consumers that use `HTMLElement` members, so the types are unchanged.

Packaging:

- **feat (packaging): `exports` lists `./package.json`.** `require('id-dom/package.json')` and `import('id-dom/package.json', { with: { type: 'json' } })` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and some tools read it. Additive: no other entry changed.

Docs:

- **docs(README): Choosing an import style.** The helper names (`button`, `input`, `select`, `form`, `div`, `el`, ...) are also natural local variable names, and `const button = button('saveBtn')` does not work. The README now recommends the default object (`dom.button('saveBtn')`) for app code with many lookups, shows aliased named imports (`import { button as buttonEl } from 'id-dom'`) and `byId(id, Type)` for a one-off, and gives the size trade-off (table above; about 0.3 KB gzip for the default object over seven named helpers).
- docs(README): ids are passed without `#`; what makes a `tagName` invalid; what `main` / `section` / `small` check (see Types); a `null` root means the whole document, so `createDom(host.shadowRoot)` searches the document when the shadow root is closed or missing; the `./package.json` export. The bundle-size note has the 0.0.9 figures.

Tests:

- `src/id-dom.test.js`: the `#` hint for every lookup path (named, default object, `tag()`, an `Element` root), the mode with it, an element whose id really starts with `#`, unchanged messages without `#`; whitespace in a `tagName` (leading, trailing, tab and newline, inside) as `'invalid-tag'` in both modes and on a scope; case-insensitive matching; `main()` matching an SVG-namespace `<main>` (the documented contract). The `#` and whitespace tests failed on 0.0.8; the unchanged-message, case-insensitive and `main()` tests record behaviour that stays.
- `test/package.test.js`: `id-dom/package.json` resolves through `exports` by package name, for `require` and for an ES module JSON import in a fresh Node process, and every `exports` target is a file the package ships. The two resolution tests failed on 0.0.8.
- `test/tree-shake.test.js`: an aliased named import bundles the same code as the plain one.
- `test/types/readme.types.ts`: the new README examples compile in strict and loose mode, and the name-clash example is a compile error (`@ts-expect-error`).

## 0.0.8 — 2026-10-07

Runtime fixes (among them: a DOM installed after import now works), a build fix (unused helpers tree-shake away), a packaging fix for CommonJS types, and dev-tooling updates. No API or type signature changes.

- **fix (runtime): the default `document` and the element constructors are read at call time.**
  - Before, both were captured once, when the module loaded. A DOM installed after import (a test setup, a late jsdom, SSR then hydration) never reached the named helpers, the default `dom` object, or a `createDom()` scope without a root. In Node, importing id-dom and then setting `globalThis.document` and `globalThis.HTMLElement` left `el('x')` throwing "requires a DOM" for ever after.
  - Each lookup now reads `globalThis[constructorName]` (`'HTMLButtonElement'`, ...) and, when no root was given, the global `document`. A DOM removed again behaves like the server (see the SSR fix below). An explicit root (`createDom(root)`, `{ root }`) is used as before.
  - With a DOM at import, behaviour is unchanged. One difference: `createDom()` without a root used the `document` of the moment it was called; it now uses the `document` of each lookup.
  - The "requires a DOM" error now names the missing constructor.
- **perf (build): unused helpers and the default object tree-shake away.**
  - Bundlers (esbuild; Parcel with Terser, as measured by dice3D-js) kept all 16 helpers, both helper registries, `createDom` and the default `dom` object, whatever was imported. The helpers and `dom` were built by module-level calls without `/* @__PURE__ */`, and `byId.optional = ...` / `tag.optional = ...` were module-level assignments, which bundlers treat as side effects.
  - Those calls are now annotated pure, and `byId` / `tag` get `.optional` / `.opt` in an annotated call. `byId.opt === byId.optional` still holds, and `byId.name` is still `"byId"`.
  - esbuild's whitespace minification drops every comment, so `build.js` puts the annotations back into `dist/index.min.js`, at the positions the sourcemap gives for each annotated call. The build fails if one does not map.
  - Consumer bundle sizes, esbuild 0.28.2 (`bundle`, `minify`, tree shaking) of `dist/index.js`, bytes raw / gzip -9. `dist/index.min.js` is within 2 bytes gzip.

    | Import | 0.0.7 | 0.0.8 |
    | --- | --- | --- |
    | `{ button }` | 6,129 / 2,094 | 3,127 / 1,415 |
    | `{ byId }` | 6,141 / 2,097 | 2,658 / 1,179 |
    | `import dom` (default) | 6,141 / 2,100 | 4,398 / 1,773 |
    | `{ button, div, el, form, input, select, byId }` | 6,136 / 2,100 | 3,315 / 1,484 |

- **types: `byId` and `tag` are declared as aliases** (`typeof byId & { optional, opt }`) instead of a function plus a namespace, a side effect of the tree-shaking fix. Their call signatures, `.optional` and `.opt` are the same, and the type tests pass unchanged.
- **fix(ssr): `createDom()` scopes and the default `dom` object keep every helper.**
  - 0.0.6 made the named typed helpers (`input`, `button`, ...) callable without a DOM, but `createDom()` skipped a helper whose global constructor is undefined. So on the server `dom.input('x')` failed with `TypeError: dom.input is not a function`, though the types and the `DomApi` docs promise the helper.
  - Every scope now gets the same shim: the base call throws "requires a DOM" in a `'throw'` scope and returns `null` in a `'null'` scope. `.optional` / `.opt` return `null`.
  - The error message no longer suggests `createDom()` with a custom root, which could not help.
- **fix(types): CommonJS consumers get CommonJS declarations.**
  - `exports["."].require` resolved its types to `id-dom.d.ts`, which TypeScript reads as an ES module because the package is `"type": "module"`. Under `module: node16`, `require('id-dom')` failed with TS1471, although `dist/index.cjs` works.
  - `build:types` now also writes `dist/types/id-dom.d.cts`, and each condition has its own `types`. The unreachable `types` / `default` entries after `import` / `require` are gone.
- **fix: a function without a `prototype` is an invalid `Type`.** `byId(id, () => {})` reached `instanceof` and threw a raw `TypeError`, even from `byId.optional` and in `'null'` mode, without calling `onError`. It is now reason `'invalid-type'` and follows the mode.
- **fix: `Element` roots from another window find their elements.** The `querySelector` result was checked with this window's `instanceof Element`, so `tag(id, 'main', { root: frameDocument.body })` reported `missing`. The check is now `nodeType === 1`.
- **fix: the `CSS.escape` fallback escapes a lone `-` id** as `\-`, like `CSS.escape`. It built `#-`, which is not a valid ID selector.
- **test: check what ships.**
  - `test/dist.test.js` runs the core contract against `dist/index.js`, `index.min.js`, and `index.cjs`. It also checks that no build reads a free Node global (`process`, `Buffer`, `global`, `setImmediate`, `require`, ...), `typeof` checks included.
  - `test/ssr.test.js` runs without a DOM against the source and every build.
  - `test/late-dom.test.js` installs a DOM after import, then removes it, for the source and every build.
  - `test/tree-shake.test.js` bundles one-helper consumers of `dist/index.js` and `dist/index.min.js` with esbuild. It checks gzip budgets, and that the other helpers, `tag()` or `byId()` where unused, the registries and `createDom` are gone.
  - `test/types/node16` imports the package by name from a `.cts` and a `.mts` consumer, and `./min` too. `test/types/readme.types.ts` compiles every README example.
  - `npm test` now builds first.
- docs(README): the scoped-root examples now use `dom.el(id)`. They used `document.querySelector`, whose `Element | null` result did not compile in strict TypeScript. Corrected which roots use `getElementById`, and documented `root`, the `onError` reasons, SSR, CommonJS, and cross-window elements.
- chore(deps), dev tooling only: `npm audit` went from 11 advisories (2 critical, 7 high, 1 moderate, 1 low) to 0.
  - Updated `esbuild` to `^0.28.2` (GHSA-g7r4-m6w7-qqqr) and `vitest` to `^4.1.11` (@vitest/mocker, tinypool, vite). `form-data` and `ws` under jsdom were updated too.
  - Every new lockfile entry is at least 7 days old.
  - The built `dist` was byte-identical with the new esbuild (before the fixes above).
  - Development now needs Node 20 or newer (vitest 4). The package itself still supports Node 18 and later.

## 0.0.7 — 2026-10-07

Types only: the runtime behaviour is unchanged.

- **types: throw-mode lookups are non-null.**
  - `byId(id, Type)` and `byId(id, Type, { mode: 'throw' })` now return `T`, and `tag(id, name)` returns `Element`.
  - They were `T | null` and `Element | null` even though throw mode never returns `null`.
  - `{ mode: 'null' }`, a config whose mode is not statically known, and `.optional` / `.opt` still return `T | null`.
  - Done with JSDoc `@overload`.
- **types: `createDom(root, { mode: 'null' })` is nullable.** It returned a `DomApi` whose base calls were typed non-null, but in a `'null'` scope they can return `null`.
  - `DomApi` and `TypedHelper` take an optional `N` (`never` by default, `null` for a `'null'` scope).
  - `createDom` returns `DomApi` for a throw scope and `DomApi<null>` otherwise.
  - Existing code that relied on the unsound non-null types in `'null'` scopes now gets a type error, which is the fix working.
- **types: fix invalid declarations for `byId.opt` / `tag.opt`.**
  - The emitted `import opt = optional` was a circular alias (TS2303, TS2503). It failed for every consumer that checks library declarations (`skipLibCheck: false`), including 0.0.6.
  - `byId.optional` and `byId.opt` (and `tag`'s) are now one named function, assigned to both properties, so `byId.opt === byId.optional` still holds.
- `tag()` stays typed `Element`, not the tag's interface, because tag names match case-insensitively (an SVG `<a>` matches `'a'`). Use `byId(id, HTMLDialogElement)` for a checked, precise type.
- **test: type tests.** `test/types/id-dom.types.ts` checks the built `dist/types/id-dom.d.ts` in strict and loose mode, with `skipLibCheck: false`.
  - It runs in `npm test` as `npm run test:types`. It fails on the 0.0.6 declarations with 13 errors.
  - `prepublishOnly` now runs `npm test`; before, it only built.
- chore: `package-lock.json` was out of sync (`typescript` missing; version 0.0.3), so `npm ci` failed. It is regenerated with the locked versions kept.

## 0.0.6 — 2026-05-23

- **fix(ssr): typed-element helpers are now always callable, even when their corresponding global constructor is undefined.** Pre-0.0.6, `defaultTypedHelper(null)` returned literal `null`, so an SSR consumer importing `input` from `id-dom` and calling `input('email')` got a cryptic `TypeError: input is not a function`. Now the SSR fallback is an always-callable shim: the base call throws a clear "DOM required" error (matches `mode: 'throw'` semantics), and `.optional` / `.opt` return `null` (matches `mode: 'null'` semantics). Browser behaviour is unchanged. Closes the SSR null-helper footgun called out in host carry-forward #6 and noted in the 0.0.5 generated `.d.ts` SSR caveat. The `.d.ts` `DomApi` typedef comment block now reflects the new behaviour.
- **chore(types): JSDoc polish — per-tag element narrowings + DomApi typedef.** Builds on the tsc-from-JSDoc pipeline that landed in 0.0.5. The generated `.d.ts` now exposes `input: TypedHelper<HTMLInputElement>` (previously `((id: any) => Element) & { optional: Function }`), `canvas: TypedHelper<HTMLCanvasElement>`, etc. `createDom` returns `DomApi` (was `any`). New `TypedHelper<T>` and `DomApi` typedefs are first-class exports.

## Unreleased — 2026-05-19

- docs(README): apply @whatty README template + rename Readme.md → README.md  `06165a1`
- chore(license): finalize AGPL-3.0 + WATT3D Additional Terms metadata  `a5c2bff`

## 0.0.5 — 2026-05-19

- chore: normalize README shields row  `0258772`
- chore: rebrand author to WATT3D, interim license  `93f1870`
- feat: relicense to AGPL-3.0 + WATT3D AI Training Rider  `d4d3065`
- chore: deploy WATT3D AI-bot robots.txt policy  `b9d38e4`
- chore: revise AI Training Rider (v2 — pre-counsel drafting fixes)  `d3ffd36`
- chore: rider v3 — remove gameable 0.1% safe harbor  `719b250`
- chore: rider v4 — Commercial Use restricted to Fully Open Source  `515c7b7`

## 0.0.4 — 2026-03-19

_(no commits in this range)_

## 0.0.3 — 2026-03-02

- initial commit  `58e5558`
- feat(dom-id): add policy-based optional helpers and .opt alias  `3ca135f`
- refactor: DRY esbuild config and remove repeated literals  `eec4c04`
- refactor(build): extract buildAll helper and add JSDoc polish  `2d6e943`
- fix(dom-id): add CSS.escape fallback and harden id escaping for querySelector roots  `475b7fb`
- name change to id-dom  `bc32c62`
- added .min.js to package.json  `45d9133`
- updated git url  `7edac27`
- bumped v 0.0.2 fixed old dom-id namew reffernces in the readme  `01d51ca`
- added badgees to readme  `6f50fa2`
- updaed licecnce url  `d9eecc6`
- cleaned emojis from readme  `544615e`
