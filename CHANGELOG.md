# CHANGELOG — `id-dom`

> Initial cut seeded from `git log` by the host repo's `tools/seed-changelogs.mjs` script. Version groupings infer release boundaries from tags and commit subjects; rough cuts are expected — review and tighten as part of normal maintenance.

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
