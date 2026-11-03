# CHANGELOG — `id-dom`

What changed for people using the package, per release. Entries before 0.0.6 were reconstructed from git history.

## 0.2.0 — 2026-10-08

- `IdDomError`, exported, with `reason` (`'missing'`, `'wrong-type'`, `'wrong-tag'`, `'invalid-id'` and others) and `id`. `onError` receives it.
- Typed getters name the type they declare in messages, not the global constructor's name, so test fakes and minified classes read correctly.

Breaking changes:
- `.opt` / `.optional` return `null` only when no element has the id. A wrong type or tag, or invalid input, now throws an `IdDomError` in a `'throw'` scope, as the hard getter does. A `createDom(root, { mode: 'null' })` scope still returns `null` for everything.
- `mode` is validated: anything other than `'throw'`, `'null'`, `undefined` or `null` throws, with reason `'invalid-mode'`. Before, a typo behaved like `'null'`.

## 0.0.9 — 2026-10-08

- An id passed with a leading `#` is quoted as passed in errors, with a hint that ids go without `#`. Lookups are unchanged.
- `require('id-dom/package.json')` works.

Behavior change: `tag()` reports a `tagName` containing whitespace as `'invalid-tag'`. Such a call never matched before either.

## 0.0.8 — 2026-10-08

- Fix: the global `document` and element constructors are read when you call a helper, so a DOM installed after import (test setup, late jsdom, hydration) works.
- Fix: importing one helper no longer bundles all of them.
- Fix: on the server, `createDom()` scopes and the default object keep every helper, which throws "requires a DOM" or returns `null` by mode.
- Fix: CommonJS consumers get CommonJS type declarations.
- Fix: a function without a `prototype` as `Type` is reason `'invalid-type'` instead of a raw `TypeError`.
- Fix: `Element` roots from another window or frame find their elements.
- Fix: the `CSS.escape` fallback escapes an id of `-`.

## 0.0.7 — 2026-10-07

- Types: throw-mode lookups return `T` instead of `T | null`; `'null'` scopes and `.opt` stay nullable.
- Types: fixed the `byId.opt` / `tag.opt` declarations, which failed with `skipLibCheck: false`.

## 0.0.6 — 2026-05-26

- Fix: typed helpers such as `input` are callable on the server, where their constructor is undefined.
- Types: each typed helper is typed with its element, such as `input: TypedHelper<HTMLInputElement>`.

## 0.0.5 — 2026-05-20

- Relicensed to AGPL-3.0 with WATT3D Additional Terms.

## 0.0.3 — 2026-03-02

- First releases on npm (0.0.1 to 0.0.3): `byId`, `tag` and typed helpers with `'throw'` / `'null'` modes, `.optional` / `.opt`, `createDom(root)` scopes, and a `CSS.escape` fallback.
