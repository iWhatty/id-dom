// id-dom.js
// id-dom — deterministic DOM element getters by ID (typed, tiny, modern)
//
// Goals:
// - Prefer getElementById (fast, unambiguous)
// - Return the correct type or fail predictably
// - Provide strict + optional variants
// - Allow app/module-level defaults (throw vs null) without bundler magic
// - Zero deps, framework-agnostic

const REASON = /** @type {const} */ ({
    INVALID_ID: 'invalid-id',
    INVALID_TYPE: 'invalid-type',
    INVALID_TAG: 'invalid-tag',
    MISSING: 'missing',
    WRONG_TYPE: 'wrong-type',
    WRONG_TAG: 'wrong-tag',
})

const SAFE_ID_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/
const NEEDS_START_ESCAPE_RE = /^(?:\d|-\d)/

/**
 * @typedef {'throw' | 'null'} DomMode
 */

/**
 * @typedef {{
 *   mode?: DomMode
 *   warn?: boolean
 *   onError?: (error: Error, ctx: any) => void
 *   root?: any
 * }} DomConfig
 */

/**
 * The callable shape exposed by every typed helper (`input`, `button`, …)
 * and tag helper (`main`, `section`, …). The base call follows the helper's
 * `mode`: in `'throw'` mode (the default, `N = never`) it returns `T`; in a
 * `'null'`-mode scope (`createDom(root, { mode: 'null' })`, `N = null`) it
 * returns `T | null`. `.optional`/`.opt` always return `T | null`.
 *
 * @template T
 * @template [N=never]
 * @typedef {((id: string) => T | N) & {
 *   optional: (id: string) => T | null,
 *   opt: (id: string) => T | null
 * }} TypedHelper
 */

/**
 * Aggregate API returned by {@link createDom}. Mirrors the named exports
 * but is scoped to the configured root.
 *
 * SSR behavior (0.0.8+): typed-element helpers are *always callable*.
 * In a non-DOM environment where the corresponding global constructor
 * is undefined (Node without jsdom, edge runtimes), the base call
 * throws a clear "requires a DOM" error in a `'throw'` scope and returns
 * `null` in a `'null'` scope; `.optional` / `.opt` return `null`. This
 * matches the throw / null semantics consumers already expect from the
 * browser path. (0.0.6 and 0.0.7 did this only for the named exports;
 * `createDom()` scopes and the default `dom` object left these helpers
 * undefined.) The constructors, and the global `document` of a scope
 * without a root, are read on each call, so a DOM installed after import
 * is used from then on.
 *
 * `N` is what a base call can return besides the element: `never` for a
 * `'throw'`-mode scope (the default), `null` for a `'null'`-mode scope.
 *
 * @template [N=never]
 * @typedef {{
 *   byId: (<T extends Element>(id: string, Type: { new (...args: any[]): T }) => T | N) & {
 *     optional: <T extends Element>(id: string, Type: { new (...args: any[]): T }) => T | null,
 *     opt: <T extends Element>(id: string, Type: { new (...args: any[]): T }) => T | null
 *   },
 *   tag: ((id: string, tagName: string) => Element | N) & {
 *     optional: (id: string, tagName: string) => Element | null,
 *     opt: (id: string, tagName: string) => Element | null
 *   },
 *   el: TypedHelper<HTMLElement, N>,
 *   input: TypedHelper<HTMLInputElement, N>,
 *   button: TypedHelper<HTMLButtonElement, N>,
 *   textarea: TypedHelper<HTMLTextAreaElement, N>,
 *   select: TypedHelper<HTMLSelectElement, N>,
 *   form: TypedHelper<HTMLFormElement, N>,
 *   div: TypedHelper<HTMLDivElement, N>,
 *   span: TypedHelper<HTMLSpanElement, N>,
 *   label: TypedHelper<HTMLLabelElement, N>,
 *   canvas: TypedHelper<HTMLCanvasElement, N>,
 *   template: TypedHelper<HTMLTemplateElement, N>,
 *   svg: TypedHelper<SVGSVGElement, N>,
 *   body: TypedHelper<HTMLBodyElement, N>,
 *   main: TypedHelper<HTMLElement, N>,
 *   section: TypedHelper<HTMLElement, N>,
 *   small: TypedHelper<HTMLElement, N>
 * }} DomApi
 */

// -----------------------------------------------------------------------------
// Environment (read at call time, never at import)
//
// A DOM installed after id-dom is imported (a test setup, a late jsdom, SSR
// then hydration) must reach every helper, and a DOM removed again must look
// like the server. So the default root and the element constructors are read
// on each lookup, not captured when the module loads.
// -----------------------------------------------------------------------------

/**
 * The global `document`, or `null` without a DOM.
 *
 * @returns {any}
 */
function currentDocument() {
    return typeof document !== 'undefined' && document ? document : null
}

/**
 * A global element constructor by name (`'HTMLButtonElement'`), or
 * `undefined` without a DOM.
 *
 * @param {string} name
 * @returns {any}
 */
function domConstructor(name) {
    return /** @type {any} */ (globalThis)[name]
}

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

/**
 * @param {DomConfig | undefined} cfg
 */
function normalizeConfig(cfg) {
    return {
        mode: cfg?.mode ?? 'throw',
        warn: cfg?.warn ?? false,
        onError: typeof cfg?.onError === 'function' ? cfg.onError : null,
        root: cfg?.root ?? currentDocument(),
    }
}

// -----------------------------------------------------------------------------
// Root / DOM helpers
// -----------------------------------------------------------------------------

/**
 * @param {unknown} v
 * @returns {v is { getElementById(id: string): Element | null }}
 */
function hasGetElementById(v) {
    return !!v && typeof v === 'object' && typeof v.getElementById === 'function'
}

/**
 * @param {unknown} v
 * @returns {v is { querySelector(sel: string): Element | null }}
 */
function hasQuerySelector(v) {
    return !!v && typeof v === 'object' && typeof v.querySelector === 'function'
}

/**
 * Minimal CSS.escape fallback for environments where CSS.escape is missing.
 * We only need to safely build `#${id}` selectors.
 *
 * @param {string} id
 * @returns {string}
 */
function cssEscape(id) {
    const s = String(id)

    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(s)
    }

    if (!NEEDS_START_ESCAPE_RE.test(s) && SAFE_ID_RE.test(s)) return s

    let out = ''
    for (let i = 0; i < s.length;) {
        const cp = s.codePointAt(i)
        const ch = String.fromCodePoint(cp)

        const isAsciiSafe =
            (cp >= 48 && cp <= 57) || // 0-9
            (cp >= 65 && cp <= 90) || // A-Z
            (cp >= 97 && cp <= 122) || // a-z
            cp === 95 || // _
            cp === 45 // -

        const next = s.codePointAt(i + 1)
        const startsWithDigit = cp >= 48 && cp <= 57
        const startsWithDashDigit = cp === 45 && s.length > 1 && next >= 48 && next <= 57
        const isLoneDash = cp === 45 && s.length === 1 // `#-` is not a valid ID selector
        const needsStartEscape = i === 0 && (startsWithDigit || startsWithDashDigit || isLoneDash)

        if (!needsStartEscape && (isAsciiSafe || cp >= 0x00a0)) {
            out += ch
        } else if (i === 0 && (startsWithDashDigit || isLoneDash)) {
            out += '\\-'
        } else {
            out += `\\${cp.toString(16).toUpperCase()} `
        }

        i += ch.length
    }

    return out
}

/**
 * Element check by node type, not `instanceof Element`, so an element from
 * another window (an iframe, a second jsdom) is still an element.
 *
 * @param {unknown} v
 * @returns {v is Element}
 */
function isElementNode(v) {
    return !!v && typeof v === 'object' && /** @type {any} */ (v).nodeType === 1
}

/**
 * Resolve an element by id from a root.
 * Supports:
 *  - Document / ShadowRoot / DocumentFragment (getElementById)
 *  - Element (querySelector fallback; searches descendants only)
 *
 * @param {any} root
 * @param {string} id
 * @returns {Element | null}
 */
function getById(root, id) {
    if (!root) return null

    if (hasGetElementById(root)) return root.getElementById(id)

    if (hasQuerySelector(root)) {
        const el = root.querySelector(`#${cssEscape(id)}`)
        return isElementNode(el) ? el : null
    }

    return null
}

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------

/**
 * @param {unknown} v
 * @returns {v is string}
 */
function isValidId(v) {
    return typeof v === 'string' && v.length > 0
}

/**
 * @param {unknown} v
 * @returns {v is string}
 */
function isValidTagName(v) {
    return typeof v === 'string' && v.trim().length > 0
}

/**
 * A usable `instanceof` right-hand side: a function with an object
 * `prototype`. Arrow functions and methods have none, and `instanceof` would
 * throw a TypeError for them.
 *
 * @param {unknown} v
 * @returns {v is Function}
 */
function isConstructor(v) {
    if (typeof v !== 'function') return false
    const proto = /** @type {any} */ (v).prototype
    return typeof proto === 'object' && proto !== null
}

// -----------------------------------------------------------------------------
// Error / policy helpers
// -----------------------------------------------------------------------------

/**
 * @param {string} id
 * @returns {string}
 */
function fmtId(id) {
    return id.startsWith('#') ? id : `#${id}`
}

/**
 * @param {string} id
 * @param {string} expected
 * @returns {Error}
 */
function missingElError(id, expected) {
    return new Error(`id-dom: missing ${expected} element ${fmtId(id)}`)
}

/**
 * @param {string} id
 * @param {string} expected
 * @param {string} got
 * @returns {Error}
 */
function wrongTypeError(id, expected, got) {
    return new Error(`id-dom: expected ${expected} for ${fmtId(id)}, got ${got}`)
}

/**
 * @template T
 * @param {Error} err
 * @param {any} ctx
 * @param {ReturnType<typeof normalizeConfig>} cfg
 * @returns {T | null}
 */
function handleLookupError(err, ctx, cfg) {
    try {
        cfg.onError?.(err, ctx)
    } catch {
        // reporting must never break app logic
    }

    if (cfg.warn) console.warn(err, ctx)

    if (cfg.mode === 'throw') throw err
    return null
}

/**
 * @param {string} id
 * @param {any} root
 * @param {string} reason
 * @param {object} [extra]
 * @returns {any}
 */
function createCtx(id, root, reason, extra) {
    return {
        id,
        root,
        reason,
        ...(extra || {}),
    }
}

// -----------------------------------------------------------------------------
// Internal generic resolver
// -----------------------------------------------------------------------------

/**
 * @template T
 * @param {DomConfig | undefined} config
 * @param {{
 *   id: string,
 *   validateInput: (cfg: ReturnType<typeof normalizeConfig>) => { err: Error, ctx: any } | null,
 *   onMissing: (cfg: ReturnType<typeof normalizeConfig>) => { err: Error, ctx: any },
 *   matches: (el: Element, cfg: ReturnType<typeof normalizeConfig>) => boolean,
 *   onMismatch: (el: Element, cfg: ReturnType<typeof normalizeConfig>) => { err: Error, ctx: any },
 * }} spec
 * @returns {T | null}
 */
function resolveLookup(config, spec) {
    const cfg = normalizeConfig(config)

    const inputFailure = spec.validateInput(cfg)
    if (inputFailure) {
        return handleLookupError(inputFailure.err, inputFailure.ctx, cfg)
    }

    const el = getById(cfg.root, spec.id)
    if (!el) {
        const failure = spec.onMissing(cfg)
        return handleLookupError(failure.err, failure.ctx, cfg)
    }

    if (!spec.matches(el, cfg)) {
        const failure = spec.onMismatch(el, cfg)
        return handleLookupError(failure.err, failure.ctx, cfg)
    }

    return /** @type {T} */ (el)
}

// -----------------------------------------------------------------------------
// Public APIs
// -----------------------------------------------------------------------------

/**
 * Typed lookup by ID. In `'throw'` mode (the default) it returns the element
 * or throws, so the result is never `null`.
 *
 * @template {Element} T
 * @overload
 * @param {string} id
 * @param {{ new (...args: any[]): T }} Type
 * @param {DomConfig & { mode?: 'throw' }} [config]
 * @returns {T}
 */
/**
 * Typed lookup by ID with a `'null'` (or not statically known) mode: returns
 * `T | null`.
 *
 * @template {Element} T
 * @overload
 * @param {string} id
 * @param {{ new (...args: any[]): T }} Type
 * @param {DomConfig} [config]
 * @returns {T | null}
 */
/**
 * @template {Element} T
 * @param {string} id
 * @param {{ new (...args: any[]): T }} Type
 * @param {DomConfig} [config]
 * @returns {T | null}
 */
function byId(id, Type, config) {
    return resolveLookup(config, {
        id,

        validateInput(cfg) {
            if (!isValidId(id)) {
                return {
                    err: new Error('id-dom: invalid id (expected non-empty string)'),
                    ctx: createCtx(String(id), cfg.root, REASON.INVALID_ID, { Type }),
                }
            }

            if (!isConstructor(Type)) {
                return {
                    err: new Error(`id-dom: invalid Type for ${fmtId(id)}`),
                    ctx: createCtx(id, cfg.root, REASON.INVALID_TYPE, { Type }),
                }
            }

            return null
        },

        onMissing(cfg) {
            return {
                err: missingElError(id, Type.name),
                ctx: createCtx(id, cfg.root, REASON.MISSING, { Type }),
            }
        },

        matches(el) {
            return el instanceof Type
        },

        onMismatch(el, cfg) {
            const got = el?.constructor?.name || typeof el
            return {
                err: wrongTypeError(id, Type.name, got),
                ctx: createCtx(id, cfg.root, REASON.WRONG_TYPE, { Type, got }),
            }
        },
    })
}

/**
 * Optional typed lookup: always returns T | null.
 *
 * @template {Element} T
 * @param {string} id
 * @param {{ new (...args: any[]): T }} Type
 * @param {DomConfig} [config]
 * @returns {T | null}
 */
function byIdOptional(id, Type, config) {
    return byId(id, Type, { ...config, mode: 'null' })
}

// Exported as `byId`. Attaching `.optional` / `.opt` in a pure call, not by
// module-level assignment, lets a bundler drop `byId` when it is unused.
/**
 * Typed lookup by ID (see the overloads of `byId`). `.optional` / `.opt`
 * return `T | null`.
 */
const byIdWithOptional = /* @__PURE__ */ attachOptional(byId, byIdOptional)
export { byIdWithOptional as byId }

/**
 * Tag-name lookup by element tag.
 * Useful when constructor checks are not the right fit. In `'throw'` mode
 * (the default) the result is never `null`. It is typed `Element`, not the
 * tag's interface: tag names match case-insensitively, so an SVG `<a>`
 * matches `'a'`. Use `byId(id, HTMLDialogElement)` for a checked, precise
 * type.
 *
 * @overload
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig & { mode?: 'throw' }} [config]
 * @returns {Element}
 */
/**
 * Tag-name lookup with a `'null'` (or not statically known) mode.
 *
 * @overload
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {Element | null}
 */
/**
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {Element | null}
 */
function tag(id, tagName, config) {
    return resolveLookup(config, {
        id,

        validateInput(cfg) {
            if (!isValidId(id)) {
                return {
                    err: new Error('id-dom: invalid id (expected non-empty string)'),
                    ctx: createCtx(String(id), cfg.root, REASON.INVALID_ID, { tagName }),
                }
            }

            if (!isValidTagName(tagName)) {
                return {
                    err: new Error(`id-dom: invalid tagName for ${fmtId(id)}`),
                    ctx: createCtx(id, cfg.root, REASON.INVALID_TAG, { tagName }),
                }
            }

            return null
        },

        onMissing(cfg) {
            return {
                err: missingElError(id, `<${tagName}>`),
                ctx: createCtx(id, cfg.root, REASON.MISSING, { tagName }),
            }
        },

        matches(el) {
            return String(el.tagName || '').toUpperCase() === String(tagName).toUpperCase()
        },

        onMismatch(el, cfg) {
            const expected = String(tagName).toUpperCase()
            const got = String(el.tagName || '').toUpperCase()

            return {
                err: wrongTypeError(id, `<${expected.toLowerCase()}>`, `<${got.toLowerCase()}>`),
                ctx: createCtx(id, cfg.root, REASON.WRONG_TAG, { tagName, got }),
            }
        },
    })
}

/**
 * Optional tag lookup: always returns Element | null.
 *
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {Element | null}
 */
function tagOptional(id, tagName, config) {
    return tag(id, tagName, { ...config, mode: 'null' })
}

// Exported as `tag`; see `byIdWithOptional`.
/**
 * Tag-name lookup by element tag (see the overloads of `tag`). `.optional` /
 * `.opt` return `Element | null`.
 */
const tagWithOptional = /* @__PURE__ */ attachOptional(tag, tagOptional)
export { tagWithOptional as tag }

// -----------------------------------------------------------------------------
// Helper registries
// -----------------------------------------------------------------------------

/** Typed helper name → global element constructor name, read at call time. */
const TYPE_HELPERS = /** @type {Record<string, string>} */ ({
    el: 'HTMLElement',
    input: 'HTMLInputElement',
    button: 'HTMLButtonElement',
    textarea: 'HTMLTextAreaElement',
    select: 'HTMLSelectElement',
    form: 'HTMLFormElement',
    div: 'HTMLDivElement',
    span: 'HTMLSpanElement',
    label: 'HTMLLabelElement',
    canvas: 'HTMLCanvasElement',
    template: 'HTMLTemplateElement',
    svg: 'SVGSVGElement',
    body: 'HTMLBodyElement',
})

const TAG_HELPERS = ['main', 'section', 'small']

// -----------------------------------------------------------------------------
// Helper builders
// -----------------------------------------------------------------------------

/**
 * @template {Function} F
 * @template {Function} O
 * @param {F} fn
 * @param {O} optionalFn
 * @returns {F & { optional: O, opt: O }}
 */
function attachOptional(fn, optionalFn) {
    fn.optional = optionalFn
    fn.opt = optionalFn
    return fn
}

/**
 * A typed helper whose constructor is looked up by name on each call.
 *
 * Without a DOM (the global constructor is undefined: Node without jsdom,
 * edge runtimes) the type cannot be checked, so the call throws a clear
 * "requires a DOM" error in a `'throw'` scope and returns `null` in a
 * `'null'` scope; `.optional` / `.opt` return `null`. Once a DOM is
 * installed, the same helper does real lookups.
 *
 * @param {string} typeName
 * @param {DomConfig} base
 * @param {DomConfig} baseNull
 */
function makeTypedHelper(typeName, base, baseNull) {
    /** @param {DomConfig} cfg */
    const lookup = (cfg) => (/** @type {string} */ id) => {
        const Type = domConstructor(typeName)
        if (Type) return byId(id, Type, cfg)
        if ((cfg.mode ?? 'throw') !== 'throw') return null
        throw new Error(
            'id-dom: typed-element helper requires a DOM. The ' + typeName +
            ' constructor is undefined in this environment ' +
            '(Node without jsdom, edge runtime, etc.). Guard SSR call sites, ' +
            'use a { mode: \'null\' } scope, or use the .optional variant, ' +
            'which returns null in non-DOM environments.'
        )
    }

    return attachOptional(lookup(base), lookup(baseNull))
}

/**
 * @param {string} tagName
 * @param {DomConfig} base
 * @param {DomConfig} baseNull
 */
function makeTagHelper(tagName, base, baseNull) {
    return attachOptional(
        (/** @type {string} */ id) => tag(id, tagName, base),
        (/** @type {string} */ id) => tag(id, tagName, baseNull)
    )
}

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

/**
 * Factory: scope getters to a specific root + default policy. A `'throw'`
 * scope (the default) returns getters whose base calls never return `null`.
 * Without a `root` the scope uses the global `document` at the time of each
 * lookup.
 *
 * @overload
 * @param {any} root
 * @param {Omit<DomConfig, 'root'> & { mode?: 'throw' }} [config]
 * @returns {DomApi}
 */
/**
 * A `'null'` (or not statically known) scope: base calls return `T | null`.
 *
 * @overload
 * @param {any} root
 * @param {Omit<DomConfig, 'root'>} [config]
 * @returns {DomApi<null>}
 */
/**
 * @param {any} root
 * @param {Omit<DomConfig, 'root'>} [config]
 * @returns {any}
 */
export function createDom(root, config) {
    // Normalized again on each lookup, so a missing root resolves then.
    const base = { ...config, root }
    const baseNull = { ...base, mode: /** @type {DomMode} */ ('null') }

    /** @type {any} */
    const api = {}

    api.byId = attachOptional(
        (/** @type {string} */ id, /** @type {any} */ Type) => byId(id, Type, base),
        (/** @type {string} */ id, /** @type {any} */ Type) => byId(id, Type, baseNull)
    )

    api.tag = attachOptional(
        (/** @type {string} */ id, /** @type {string} */ name) => tag(id, name, base),
        (/** @type {string} */ id, /** @type {string} */ name) => tag(id, name, baseNull)
    )

    for (const name in TYPE_HELPERS) {
        api[name] = makeTypedHelper(TYPE_HELPERS[name], base, baseNull)
    }

    for (const tagName of TAG_HELPERS) {
        api[tagName] = makeTagHelper(tagName, base, baseNull)
    }

    return api
}

// -----------------------------------------------------------------------------
// Default-root config (shared by the default export and the named helpers).
// No root: each lookup uses the global `document` of that moment.
// -----------------------------------------------------------------------------

/** @type {DomConfig} */
const DEFAULT_BASE = { mode: 'throw' }
/** @type {DomConfig} */
const DEFAULT_BASE_NULL = { mode: 'null' }

/**
 * Build a typed helper bound to the default root.
 * Internal — exposed via the per-helper named exports below.
 *
 * @param {string} typeName global constructor name, read at call time
 * @returns {TypedHelper<any>}
 */
function defaultTypedHelper(typeName) {
    return /** @type {any} */ (makeTypedHelper(typeName, DEFAULT_BASE, DEFAULT_BASE_NULL))
}

/**
 * Build a tag-name helper bound to the default root.
 *
 * @param {string} tagName
 */
function defaultTagHelper(tagName) {
    return makeTagHelper(tagName, DEFAULT_BASE, DEFAULT_BASE_NULL)
}

// -----------------------------------------------------------------------------
// Named typed-element helpers (per-helper exports)
//
// Each is built in a call annotated pure and nothing else at module level
// refers to it, so a bundler drops every helper a consumer does not import
// (and the default `dom` object below, unless it is imported).
//
// SSR-safe: without a DOM, a helper's base call throws "requires a DOM" and
// its .optional/.opt return null (see makeTypedHelper). A DOM installed after
// import is picked up on the next call.
// -----------------------------------------------------------------------------

/** @type {TypedHelper<HTMLElement>} */
export const el       = /* @__PURE__ */ defaultTypedHelper('HTMLElement')
/** @type {TypedHelper<HTMLInputElement>} */
export const input    = /* @__PURE__ */ defaultTypedHelper('HTMLInputElement')
/** @type {TypedHelper<HTMLButtonElement>} */
export const button   = /* @__PURE__ */ defaultTypedHelper('HTMLButtonElement')
/** @type {TypedHelper<HTMLTextAreaElement>} */
export const textarea = /* @__PURE__ */ defaultTypedHelper('HTMLTextAreaElement')
/** @type {TypedHelper<HTMLSelectElement>} */
export const select   = /* @__PURE__ */ defaultTypedHelper('HTMLSelectElement')
/** @type {TypedHelper<HTMLFormElement>} */
export const form     = /* @__PURE__ */ defaultTypedHelper('HTMLFormElement')
/** @type {TypedHelper<HTMLDivElement>} */
export const div      = /* @__PURE__ */ defaultTypedHelper('HTMLDivElement')
/** @type {TypedHelper<HTMLSpanElement>} */
export const span     = /* @__PURE__ */ defaultTypedHelper('HTMLSpanElement')
/** @type {TypedHelper<HTMLLabelElement>} */
export const label    = /* @__PURE__ */ defaultTypedHelper('HTMLLabelElement')
/** @type {TypedHelper<HTMLCanvasElement>} */
export const canvas   = /* @__PURE__ */ defaultTypedHelper('HTMLCanvasElement')
/** @type {TypedHelper<HTMLTemplateElement>} */
export const template = /* @__PURE__ */ defaultTypedHelper('HTMLTemplateElement')
/** @type {TypedHelper<SVGSVGElement>} */
export const svg      = /* @__PURE__ */ defaultTypedHelper('SVGSVGElement')
/** @type {TypedHelper<HTMLBodyElement>} */
export const body     = /* @__PURE__ */ defaultTypedHelper('HTMLBodyElement')

// Named tag-name helpers (no dedicated constructor — return base Element)
/** @type {TypedHelper<HTMLElement>} */
export const main    = /* @__PURE__ */ defaultTagHelper('main')
/** @type {TypedHelper<HTMLElement>} */
export const section = /* @__PURE__ */ defaultTagHelper('section')
/** @type {TypedHelper<HTMLElement>} */
export const small   = /* @__PURE__ */ defaultTagHelper('small')

// -----------------------------------------------------------------------------
// Default export — the convenience object aggregating every helper, bound to
// the global `document` of each lookup. Use named imports above for
// tree-shake-friendly bundles; use this default when you want all helpers
// under one namespace (`dom.button(…)`).
// -----------------------------------------------------------------------------

const dom = /* @__PURE__ */ createDom(undefined, { mode: 'throw' })
export default dom
